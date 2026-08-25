[CmdletBinding()]
param([int]$Port = 8787)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar)
$suffix = [guid]::NewGuid().ToString("N")
$stage = Join-Path $tempRoot "gov-project-os-m07-$suffix"
$container = "gov-project-os-m07-$suffix"

try {
	[void](New-Item -ItemType Directory -Path $stage)
	& git -C $repoRoot archive --format=tar HEAD -o (Join-Path $stage "source.tar")
	if ($LASTEXITCODE -ne 0) { throw "Tracked-source archive failed." }

	& docker run --name $container -d -p "127.0.0.1:${Port}:8787" `
		-e "NEXT_PUBLIC_SUPABASE_URL=https://synthetic.invalid" `
		-e "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-public-key" `
		--mount "type=bind,src=$stage,dst=/workspace" `
		node:24.19.0-bookworm-slim sh -lc `
		"mkdir /app && tar -xf /workspace/source.tar -C /app && cd /app && corepack enable && corepack prepare pnpm@11.19.0 --activate && pnpm install --frozen-lockfile && pnpm build && pnpm exec opennextjs-cloudflare build && pnpm exec opennextjs-cloudflare preview --ip 0.0.0.0 --port 8787" | Out-Null
	if ($LASTEXITCODE -ne 0) { throw "Workers container did not start." }

	$deadline = (Get-Date).AddMinutes(10)
	$response = $null
	do {
		Start-Sleep -Seconds 2
		try {
			$response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -TimeoutSec 5
			if ($response.StatusCode -eq 200 -and $response.Content -match "GOV Project OS") { break }
		} catch {
			$response = $null
		}
		$running = & docker inspect --format "{{.State.Running}}" $container 2>$null
		if ($running -eq "false") { throw "Workers container exited before the HTTP probe passed." }
	} while ((Get-Date) -lt $deadline)

	if (-not $response -or $response.StatusCode -ne 200) { throw "Workers HTTP probe timed out." }
} finally {
	& docker rm -f $container 2>$null | Out-Null
	if (Test-Path -LiteralPath $stage) {
		$resolvedStage = (Resolve-Path -LiteralPath $stage).Path
		$requiredPrefix = $tempRoot + [IO.Path]::DirectorySeparatorChar
		if (-not $resolvedStage.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
			throw "Refusing cleanup outside the system temp directory."
		}
		Remove-Item -LiteralPath $resolvedStage -Recurse -Force
	}
}
