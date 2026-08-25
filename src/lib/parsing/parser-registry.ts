import { DocumentParseError, type DocumentParser } from "./document-parser";
import { PlainTextDocumentParser } from "./plain-text-document-parser";

type ParserResolution = {
	canonicalMimeType: string;
	parser: DocumentParser;
};

export class ParserRegistry {
	constructor(private readonly parsers: readonly DocumentParser[]) {}

	resolve(originalFilename: string): ParserResolution {
		const canonicalMimeType = originalFilename.toLowerCase().endsWith(".txt")
			? "text/plain"
			: undefined;
		if (!canonicalMimeType) {
			throw new DocumentParseError("UNSUPPORTED_FORMAT");
		}

		const parser = this.parsers.find((candidate) => candidate.supports(canonicalMimeType));
		if (!parser) {
			throw new DocumentParseError("UNSUPPORTED_FORMAT");
		}
		return { canonicalMimeType, parser };
	}
}

export function createParserRegistry(
	parsers: readonly DocumentParser[] = [new PlainTextDocumentParser()],
): ParserRegistry {
	return new ParserRegistry(parsers);
}
