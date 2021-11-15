import { ethers } from "ethers";
import { IUniswapV3Pool } from "../abis/types";
import { IERC20, IERC20Metadata__factory, IQuoter } from "../typechain";
import { fromBN, toBN, toWei } from "../utils";

interface Immutables {
  factory: string;
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  maxLiquidityPerTick: ethers.BigNumber;
}

interface State {
  liquidity: ethers.BigNumber;
  sqrtPriceX96: ethers.BigNumber;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
}

export const getPoolImmutables = async (poolContract: IUniswapV3Pool) => {
  const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] = await Promise.all([
    poolContract.factory(),
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee(),
    poolContract.tickSpacing(),
    poolContract.maxLiquidityPerTick(),
  ]);

  const immutables: Immutables = {
    factory,
    token0,
    token1,
    fee,
    tickSpacing,
    maxLiquidityPerTick,
  };

  return immutables;
};

export const getPoolState = async (poolContract: IUniswapV3Pool) => {
  const [liquidity, slot] = await Promise.all([poolContract.liquidity(), poolContract.slot0()]);

  const PoolState: State = {
    liquidity,
    sqrtPriceX96: slot[0],
    tick: slot[1],
    observationIndex: slot[2],
    observationCardinality: slot[3],
    observationCardinalityNext: slot[4],
    feeProtocol: slot[5],
    unlocked: slot[6],
  };

  return PoolState;
};

export const getPrice = async (tokenIn: IERC20, tokenOut: IERC20, poolFee: number, quoter: IQuoter) => {
  const tokenInMetadata = IERC20Metadata__factory.connect(tokenIn.address, tokenIn.provider);
  const amoutIn = toBN(10).pow(await tokenInMetadata.decimals());
  const amountOut = await quoter.callStatic.quoteExactInputSingle(
    tokenIn.address,
    tokenOut.address,
    poolFee,
    amoutIn,
    0,
  );
  return amountOut;
};
