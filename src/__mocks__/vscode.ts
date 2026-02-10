export const workspace = {
  getConfiguration: () => ({
    get: (key: string, defaultValue: unknown) => defaultValue,
  }),
};

export class Position {
  constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
  constructor(public readonly start: Position, public readonly end: Position) {}
}

export class Color {
  constructor(
    public readonly red: number,
    public readonly green: number,
    public readonly blue: number,
    public readonly alpha: number
  ) {}
}

export class ColorInformation {
  constructor(public readonly range: Range, public readonly color: Color) {}
}

export class ColorPresentation {
  constructor(public readonly label: string) {}
}

export interface TextDocument {
  getText(): string;
  positionAt(offset: number): Position;
}

export type CancellationToken = { isCancellationRequested: boolean };

export function createMockDocument(text: string): TextDocument {
  return {
    getText: () => text,
    positionAt(offset: number): Position {
      let line = 0;
      let char = 0;
      for (let i = 0; i < offset && i < text.length; i++) {
        if (text[i] === "\n") {
          line++;
          char = 0;
        } else {
          char++;
        }
      }
      return new Position(line, char);
    },
  };
}
