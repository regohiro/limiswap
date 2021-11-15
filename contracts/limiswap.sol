//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import "./KeeperBase.sol";

contract LimiSwap is KeeperCompatibleInterface, KeeperBase, Ownable {
  //Address of keeper registery
  address public keeperRegistery;

  //Address of Uniswap Router
  ISwapRouter public swapRouter;

  //Address of Quoter contract
  IQuoter public quoter;

  //OrderId counter
  uint256 private orderIdCounter;

  //Mapping from orderId to index of orders array
  mapping(uint256 => uint256) private orderIdIndex;

  //List of all active orders
  Order[] private orders;

  struct Order {
    uint256 orderId;
    uint256 targetPrice;
    uint256 amountIn;
    address tokenIn;
    address tokenOut;
    address user;
    uint24 poolFee;
    uint16 slippage;
  }

  event OrderCreated(
    uint256 indexed orderId,
    uint256 targetPrice,
    uint256 amountIn,
    address tokenIn,
    address tokenOut,
    address indexed user,
    uint24 poolFee,
    uint16 slippage
  );
  event OrderCanceled(uint256 indexed orderId);
  event OrderFilled(uint256 indexed orderId);

  /**
   * @dev Initializes the contract by setting `keeperRegistery` and `swapRouter`
   * @dev Creates empty order to fill the 0th spot of the orders array
   */
  constructor(
    address keeperRegistery_,
    ISwapRouter swapRouter_,
    IQuoter quoter_
  ) {
    keeperRegistery = keeperRegistery_;
    swapRouter = swapRouter_;
    quoter = quoter_;

    _createOrder(0, 0, address(0), address(0), address(0), 0, 0);
  }

  modifier onlyKeeper() {
    require(msg.sender == keeperRegistery, "Invalid access");
    _;
  }

  function getTime() public view returns (uint32) {
    return uint32(block.timestamp);
  }

  function getOrder(uint256 orderId) external view returns (Order memory) {
    require(orderIdIndex[orderId] != 0, "Query for nonexistent order");
    return orders[orderIdIndex[orderId]];
  }

  function createOrder(
    uint256 price,
    uint256 amountIn,
    address tokenIn,
    address tokenOut,
    uint24 poolFee,
    uint16 slippage
  ) external {
    //Checks
    require(slippage <= 10000, "Slippage out of bound");

    //Effects
    address user = msg.sender;
    _createOrder(price, amountIn, tokenIn, tokenOut, user, poolFee, slippage);

    //Interactions
    IERC20 token = IERC20(tokenIn);
    token.transferFrom(user, address(this), amountIn);
    if (token.allowance(address(this), address(swapRouter)) == 0) {
      token.approve(address(swapRouter), ~uint256(0));
    }

    emit OrderCreated(orderIdCounter - 1, price, amountIn, tokenIn, tokenOut, user, poolFee, slippage);
  }

  function cancelOrder(uint256 orderId) external {
    //Checks
    uint256 index = orderIdIndex[orderId];
    require(index != 0, "Order does not exist");
    Order memory order = orders[index];
    require(order.user == msg.sender, "Invalid access");

    //Effects
    _deleteOrder(orderId);

    //Interactions
    IERC20 token = IERC20(order.tokenIn);
    token.transfer(order.user, order.amountIn);

    emit OrderCanceled(order.orderId);
  }

  function checkUpkeep(bytes calldata checkData) external override cannotExecute returns (bool, bytes memory) {
    uint256 allOrders = orders.length;

    for (uint256 i = 1; i < allOrders; i++) {
      Order memory order = orders[i];
      uint256 price = _getPrice(order.tokenIn, order.tokenOut, order.poolFee);
      if (price > order.targetPrice) {
        return (true, abi.encodePacked(i));
      }
    }
    return (false, checkData);
  }

  function performUpkeep(bytes calldata performData) external override onlyKeeper {
    uint256 index = abi.decode(performData, (uint256));
    Order memory order = orders[index];

    //Effects
    _deleteOrder(order.orderId);

    //Interactions
    _swapExactInputSingle(
      order.amountIn,
      order.tokenIn,
      order.tokenOut,
      order.user,
      order.poolFee,
      order.targetPrice,
      order.slippage
    );

    emit OrderFilled(order.orderId);
  }

  function updateRouter(ISwapRouter swapRouter_) external onlyOwner {
    swapRouter = swapRouter_;
  }

  function updateKeeper(address keeperRegistery_) external onlyOwner {
    keeperRegistery = keeperRegistery_;
  }

  function _createOrder(
    uint256 price,
    uint256 amountIn,
    address tokenIn,
    address tokenOut,
    address user,
    uint24 poolFee,
    uint16 slippage
  ) private {
    Order memory newOrder = Order(orderIdCounter, price, amountIn, tokenIn, tokenOut, user, poolFee, slippage);
    orderIdIndex[orderIdCounter++] = orders.length;
    orders.push(newOrder);
  }

  function _deleteOrder(uint256 orderId) private {
    Order[] storage allOrders = orders;
    uint256 index = orderIdIndex[orderId];
    uint256 lastIndex = allOrders.length - 1;
    if (index != lastIndex) {
      allOrders[index] = allOrders[lastIndex];
    }
    allOrders.pop();
    delete orderIdIndex[orderId];
  }

  function _getPrice(
    address tokenIn,
    address tokenOut,
    uint24 poolFee
  ) private returns (uint256 amountOut) {
    IERC20Metadata token = IERC20Metadata(tokenIn);
    uint256 amountIn = 10 ** token.decimals();
    amountOut = quoter.quoteExactInputSingle(tokenIn, tokenOut, poolFee, amountIn, 0);
  }

  function _swapExactInputSingle(
    uint256 amountIn,
    address tokenIn,
    address tokenOut,
    address user,
    uint24 poolFee,
    uint256 targetPrice,
    uint16 slippage
  ) private returns (uint256 amountOut) {
    IERC20Metadata token = IERC20Metadata(tokenIn);

    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      fee: poolFee,
      recipient: user,
      deadline: block.timestamp + 100,
      amountIn: amountIn,
      amountOutMinimum: (amountIn * targetPrice * (10000 - slippage)) / (10000 * 10 ** token.decimals()),
      sqrtPriceLimitX96: 0
    });

    amountOut = swapRouter.exactInputSingle(params);
  }
}