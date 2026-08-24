export type EvalCheck = {
	id: string;
	passed: boolean;
};

export type EvalSummary = {
	passed: boolean;
	failedCheckIds: string[];
};

export function summarizeEvalChecks(checks: EvalCheck[]): EvalSummary {
	const failedCheckIds = checks.filter((check) => !check.passed).map((check) => check.id);

	return {
		passed: failedCheckIds.length === 0,
		failedCheckIds,
	};
}
