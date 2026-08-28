import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8");

function deployJobText() {
	const marker = workflow.match(/(?:^|\r?\n)  deploy:\r?\n/);
	assert.ok(marker?.index !== undefined, "deploy job must exist");
	return workflow.slice(marker.index);
}

function requiredMatch(text, pattern, description) {
	const match = text.match(pattern);
	assert.ok(match?.[1], description);
	return match[1];
}

function underFixtureRoot(root, absolutePosixPath) {
	return join(root, ...absolutePosixPath.split("/").filter(Boolean));
}

test("the deploy job extracts the tar file downloaded inside the artifact directory", () => {
	const deployJob = deployJobText();
	const downloadDirectory = requiredMatch(
		deployJob,
		/uses: actions\/download-artifact@v4[\s\S]*?name: opennext-build\s+path: (\/tmp\/[^\s]+)/,
		"deploy job must download the opennext-build artifact",
	);
	const extractionInput = requiredMatch(
		deployJob,
		/- name: Extract \.open-next from artifact[\s\S]*?tar -xzf (\/tmp\/[^\s]+) -C \.open-next/,
		"deploy job must extract the downloaded tar file",
	);

	const fixtureRoot = mkdtempSync(join(tmpdir(), "gov-project-os-artifact-"));
	try {
		const simulatedDownloadDirectory = underFixtureRoot(fixtureRoot, downloadDirectory);
		mkdirSync(simulatedDownloadDirectory, { recursive: true });
		writeFileSync(join(simulatedDownloadDirectory, "opennext-build.tar.gz"), "synthetic artifact");

		const simulatedExtractionInput = underFixtureRoot(fixtureRoot, extractionInput);
		assert.equal(
			statSync(simulatedExtractionInput).isFile(),
			true,
			"actions/download-artifact treats path as a directory, so tar must read the file inside it",
		);
	} finally {
		rmSync(fixtureRoot, { recursive: true, force: true });
	}
});
