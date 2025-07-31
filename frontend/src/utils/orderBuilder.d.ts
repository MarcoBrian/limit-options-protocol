import { ethers } from 'ethers';

export declare function buildCompleteCallOption(params: {
  makerSigner: ethers.Signer;
  underlyingAsset: string;
  strikeAsset: string;
  dummyTokenAddress: string;
  strikePrice: string | number;
  optionAmount: string | number;
  premium: string | number;
  expiry: number;
  lopAddress: string;
  optionsNFTAddress: string;
  salt?: number;
  lopNonce?: number;
  customMakerTraits?: bigint;
}): Promise<any>;

export declare function buildOrder(params: any): any;
export declare function signOrder(order: any, signer: ethers.Signer, lopAddress: string, originalAddresses: any): Promise<any>;
export declare function signOptionsNFT(optionParams: any, signer: ethers.Signer, optionsNFTAddress: string, salt?: number | null): Promise<any>;
export declare function buildOptionsNFTInteraction(params: any): any;
export declare function generateUniqueSalt(maker: string, optionParams: any): number;
export declare function toAddressType(addr: string): string;
export declare function createMakerTraitsSimple(options?: any): bigint; 