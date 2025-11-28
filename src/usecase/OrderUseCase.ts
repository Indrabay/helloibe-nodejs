import { Order, OrderCreationAttributes } from '../models/Order';
import { OrderItemCreationAttributes } from '../models/OrderItem';
import { OrderRepository } from '../repository/OrderRepository';
import { ProductRepository } from '../repository/ProductRepository';
import { StoreRepository } from '../repository/StoreRepository';
import { InventoryRepository } from '../repository/InventoryRepository';
import { GetLogger } from '../utils/loggerContext';
import { User } from '../models';

export interface CheckoutItem {
  product_id: string;
  quantity: number;
}

export interface CheckoutRequest {
  customer_name?: string;
  grand_total: number;
  items: CheckoutItem[];
}

export class OrderUseCase {
  private orderRepository: OrderRepository;
  private productRepository: ProductRepository;
  private storeRepository: StoreRepository;
  private inventoryRepository: InventoryRepository;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.storeRepository = new StoreRepository();
    this.inventoryRepository = new InventoryRepository();
  }

  private generateInvoiceNumber(storeCode: string): string {
    const logger = GetLogger();
    logger?.debug('OrderUseCase.generateInvoiceNumber - Starting', { storeCode });
    
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    const invoiceNumber = `${storeCode.toUpperCase()}${year}${month}${day}${hours}${minutes}${seconds}`;
    
    logger?.debug('OrderUseCase.generateInvoiceNumber - Completed', { invoiceNumber });
    return invoiceNumber;
  }

  async Checkout(data: CheckoutRequest, userId: string): Promise<Order> {
    const logger = GetLogger();
    logger?.debug('OrderUseCase.Checkout - Starting', { userId, itemCount: data.items.length });
    
    if (!data.items || data.items.length === 0) {
      logger?.error('OrderUseCase.Checkout - Items are required');
      throw new Error('Items are required');
    }
    
    if (!data.grand_total || data.grand_total <= 0) {
      logger?.error('OrderUseCase.Checkout - Grand total must be greater than 0');
      throw new Error('Grand total must be greater than 0');
    }
    
    // Get user and store
    const user = await User.findByPk(userId, {
      include: [{ association: 'store' }, { association: 'role' }],
    });
    
    if (!user) {
      logger?.error('OrderUseCase.Checkout - User not found');
      throw new Error('User not found');
    }
    
    if (!user.store_id) {
      logger?.error('OrderUseCase.Checkout - User must have a store assigned');
      throw new Error('User must have a store assigned');
    }
    
    const store = await this.storeRepository.FindById(user.store_id);
    if (!store) {
      logger?.error('OrderUseCase.Checkout - Store not found');
      throw new Error('Store not found');
    }
    
    if (!store.store_code) {
      logger?.error('OrderUseCase.Checkout - Store does not have a store_code');
      throw new Error('Store does not have a store_code');
    }
    
    // Validate items and check inventory
    const orderItems: OrderItemCreationAttributes[] = [];
    let calculatedTotal = 0;
    
    for (const item of data.items) {
      if (!item.product_id) {
        throw new Error('Product ID is required for all items');
      }
      
      if (!item.quantity || item.quantity <= 0) {
        throw new Error(`Quantity must be greater than 0 for product ${item.product_id}`);
      }
      
      // Get product
      const product = await this.productRepository.FindById(item.product_id);
      if (!product) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      
      // Verify product belongs to user's store
      if (product.store_id !== user.store_id) {
        throw new Error(`Product ${product.name} does not belong to your store`);
      }
      
      // Check inventory availability
      const availableQuantity = await this.inventoryRepository.GetTotalInventoryQuantity(item.product_id);
      if (item.quantity > availableQuantity) {
        throw new Error(`Insufficient inventory for product ${product.name}. Available: ${availableQuantity}, Requested: ${item.quantity}`);
      }
      
      // Calculate item total price
      const itemTotalPrice = parseFloat(product.selling_price.toString()) * item.quantity;
      calculatedTotal += itemTotalPrice;
      
      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        total_price: itemTotalPrice,
      });
    }
    
    // Validate grand total matches calculated total
    if (Math.abs(calculatedTotal - data.grand_total) > 0.01) {
      logger?.error('OrderUseCase.Checkout - Grand total mismatch', { calculated: calculatedTotal, provided: data.grand_total });
      throw new Error(`Grand total mismatch. Calculated: ${calculatedTotal.toFixed(2)}, Provided: ${data.grand_total.toFixed(2)}`);
    }
    
    // Generate invoice number
    const invoiceNumber = this.generateInvoiceNumber(store.store_code);
    
    // Create order
    const orderData: OrderCreationAttributes = {
      invoice_number: invoiceNumber,
      customer_name: data.customer_name || null,
      total_price: calculatedTotal,
      store_id: user.store_id,
      created_by: userId,
    };
    
    const order = await this.orderRepository.Create(orderData, orderItems);
    
    // Reduce inventory quantity for each order item
    for (const item of data.items) {
      try {
        await this.inventoryRepository.ReduceInventoryQuantity(item.product_id, item.quantity);
        logger?.debug('OrderUseCase.Checkout - Reduced inventory', { 
          productId: item.product_id, 
          quantity: item.quantity 
        });
      } catch (error: any) {
        logger?.error('OrderUseCase.Checkout - Failed to reduce inventory', error, { 
          productId: item.product_id, 
          quantity: item.quantity 
        });
        // Note: In a production system, you might want to rollback the order here
        // For now, we'll log the error but the order is already created
        throw new Error(`Failed to reduce inventory for product ${item.product_id}: ${error.message}`);
      }
    }
    
    logger?.info('OrderUseCase.Checkout - Completed', { id: order.id, invoice_number: order.invoice_number });
    return order;
  }

  async GetAllOrdersWithPagination(limit: number, offset: number): Promise<{ orders: Order[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('OrderUseCase.GetAllOrdersWithPagination - Starting', { limit, offset });
    
    const result = await this.orderRepository.FindAllWithPagination(limit, offset);
    logger?.debug('OrderUseCase.GetAllOrdersWithPagination - Completed', { count: result.orders.length, total: result.total });
    return result;
  }

  async GetOrderById(id: number): Promise<Order> {
    const logger = GetLogger();
    logger?.debug('OrderUseCase.GetOrderById - Starting', { id });
    
    if (!id) {
      logger?.error('OrderUseCase.GetOrderById - Order ID is required');
      throw new Error('Order ID is required');
    }
    
    const order = await this.orderRepository.FindById(id);
    if (!order) {
      logger?.warn('OrderUseCase.GetOrderById - Order not found', { id });
      throw new Error('Order not found');
    }
    
    logger?.debug('OrderUseCase.GetOrderById - Completed', { id });
    return order;
  }
}

