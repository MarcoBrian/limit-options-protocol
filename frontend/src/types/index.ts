export interface Option {
  underlyingAsset: string;
  strikeAsset: string;
  maker: string;
  strikePrice: string;
  expiry: number;
  amount: string;
  exercised: boolean;
}

export interface Order {
  salt: string;
  maker: string;
  receiver: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  makerTraits: string;
}

export interface OrderSignature {
  r: string;
  s: string;
  v: number;
}

export interface OptionParams {
  underlyingAsset: string;
  strikeAsset: string;
  strikePrice: string;
  optionAmount: string;
  premium: string;
  expiry: number;
}

export interface OrderSubmission {
  order: Order;
  signature: OrderSignature;
  lopAddress: string;
  optionParams: OptionParams;
  optionsNFTSignature: OrderSignature;
  optionsNFTAddress: string;
  optionsNFTSalt?: string; // Add optional OptionsNFT salt
  interactionData?: string; // Add optional interaction data
}

export interface OrderResponse {
  success: boolean;
  message: string;
  data: {
    orderHash: string;
    maker: string;
    status: string;
    id: number;
  };
}

export interface OrdersResponse {
  success: boolean;
  data: {
    orders: Array<{
      orderHash: string;
      maker: string;
      makerAsset: string;
      takerAsset: string;
      makingAmount: string;
      takingAmount: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      orderData: any;
      optionParams: OptionParams;
    }>;
    count: number;
  };
}

export interface WalletContextType {
  account: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
  provider: any;
  signer: any; // Add signer property
}

export interface AppContextType {
  orders: any[];
  loading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  submitOrder: (orderData: OrderSubmission) => Promise<void>;
  exerciseOption: (optionId: number) => Promise<void>;
} 