export declare class OrderHashManager {
  private usedSalts: Set<string>;
  generateUniqueSalt(makerAddress: string, optionParams: any): string;
}

export declare class RandomNonceManager {
  generateRandomNonce(): bigint;
  getRandomNonce(maker: string): Promise<bigint>;
} 