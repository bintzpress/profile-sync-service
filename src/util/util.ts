export class StringAccumulator {
  private data: string;
  constructor() {
    this.data = '';
  }

  reset() {
    this.data = '';
  }

  append(dataToAppend: string) {
    this.data = this.data + dataToAppend;
  }

  get(): string {
    return this.data;
  }
}