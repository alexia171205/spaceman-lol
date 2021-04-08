declare module '@openzeppelin/test-helpers' {
  export function expectEvent(
    receipt: any,
    eventName: string,
    eventArgs?: Record<string, unknown>
  ): void;
  export function expectRevert(promise: Promise<unknown>, message: string): void;
}
