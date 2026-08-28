[CmdletBinding()]
param(
	[switch]$BuildOnly
)

$ErrorActionPreference = "Stop"
# Ensure git/wrangler/docker are discoverable when this script runs from a
# background process that did not inherit the interactive PATH.
$env:Path = "$env:ProgramFiles\Git\bin;$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin;$env:Path"
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$tempRoot = [IO.Path]::GetFullPath($env:TEMP).TrimEnd([IO.Path]::DirectorySeparatorChar)
$suffix = [guid]::NewGuid().ToString("N")
$stage = Join-Path $tempRoot "gov-project-os-deploy-$suffix"
$container = "gov-project-os-deploy-$suffix"
$localOpenNext = Join-Path $repoRoot ".open-next"
$prodSupabaseUrl = "https://epudzahxpgmvnfdzahff.supabase.co"
$prodSupabaseAnon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwdWR6YWh4cGdtdm5mZHphaGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NDk1MDUsImV4cCI6MjEwMzQyNTUwNX0.DTfPf1TVfEw5SBLhnnhfiXtb7whTyl2vSHFYSjH2EI0"

try {
	if (-not (Test-Path -LiteralPath "$repoRoot\.git")) {
		throw "Run this script from a git checkout (a .git directory must exist at $repoRoot)."
	}
	[void](New-Item -ItemType Directory -Path $stage)
	& git -C $repoRoot archive --format=tar HEAD -o (Join-Path $stage "source.tar")
	if ($LASTEXITCODE -ne 0) { throw "Tracked-source archive failed." }

	& docker run --name $container -d `
		-e "NEXT_PUBLIC_SUPABASE_URL=$prodSupabaseUrl" `
		-e "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$prodSupabaseAnon" `
		--mount "type=bind,src=$stage,dst=/workspace" `
		--mount "type=volume,src=gov-project-os-pnpm-store,dst=/app/.pnpm-store" `
		node:24.19.0-bookworm-slim sh -lc `
		"mkdir /app && tar -xf /workspace/source.tar -C /app && cd /app && corepack enable && corepack prepare pnpm@11.19.0 --activate && pnpm config set store-dir /app/.pnpm-store && pnpm install --frozen-lockfile && pnpm build && pnpm exec opennextjs-cloudflare build && tar -czf /workspace/opennext.tar.gz -C .open-next ." | Out-Null
	if ($LASTEXITCODE -ne 0) { throw "Linux build container did not start." }

	Write-Output "Linux container build started. Waiting for completion (this can take several minutes)..."

	$deadline = (Get-Date).AddMinutes(30)
	while ((Get-Date) -lt $deadline) {
		Start-Sleep -Seconds 5
		$running = & docker inspect --format "{{.State.Running}}" $container 2>$null
		$exitCode = & docker inspect --format "{{.State.ExitCode}}" $container 2>$null
		if ($running -eq "false") {
			if ($exitCode -ne 0) {
				& docker logs $container
				throw "Linux build container exited with code $exitCode."
			}
			break
		}
		Write-Output "  ...still building"
	}

	$finalExit = & docker inspect --format "{{.State.ExitCode}}" $container 2>$null
	if ($finalExit -ne 0) {
		& docker logs $container
		throw "Linux build failed (exit $finalExit)."
	}

	# Copy the build artifact from the bind mount back into the repo.
	if (Test-Path -LiteralPath $localOpenNext) {
		Remove-Item -LiteralPath $localOpenNext -Recurse -Force
	}
	[void](New-Item -ItemType Directory -Path $localOpenNext)
	Get-ChildItem -Path (Join-Path $stage "opennext.tar.gz") -ErrorAction Stop | ForEach-Object {
		tar -xzf $_.FullName -C $localOpenNext
	}
	Write-Output "Build artifact written to $localOpenNext"

	if (-not $BuildOnly) {
		Write-Output "Deploying to Cloudflare Workers..."
		& npx wrangler deploy
		if ($LASTEXITCODE -ne 0) { throw "wrangler deploy failed." }
		Write-Output "Deploy complete."
	}
} finally {
	& docker rm -f $container 2>$null | Out-Null
	if (Test-Path -LiteralPath $stage) {
		$resolvedStage = (Resolve-Path -LiteralPath $stage).Path
		$requiredPrefix = $tempRoot + [IO.Path]::DirectorySeparatorChar
		if ($resolvedStage.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
			Remove-Item -LiteralPath $resolvedStage -Recurse -Force
		}
	}
}
