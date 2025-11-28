import { Order, OrderAttributes, OrderCreationAttributes } from '../models/Order';
import { OrderItem, OrderItemCreationAttributes } from '../models/OrderItem';
import { GetLogger } from '../utils/loggerContext';
import { Sequelize, QueryTypes } from 'sequelize';
import { sequelize } from '../models';

export class OrderRepository {
  async FindAllWithPagination(limit: number, offset: number): Promise<{ orders: Order[]; total: number }> {
    const logger = GetLogger();
    logger?.debug('OrderRepository.FindAllWithPagination - Executing query', { limit, offset });
    
    const { count, rows } = await Order.findAndCountAll({
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'store', attributes: ['id', 'name', 'store_code'] },
        {
          association: 'orderItems',
          attributes: ['id', 'product_id', 'quantity', 'total_price'],
          include: [
            { association: 'product', attributes: ['id', 'name', 'sku', 'selling_price'] },
          ],
        },
      ],
      distinct: true,
    });
    logger?.debug('OrderRepository.FindAllWithPagination - Query completed', { count, returned: rows.length });
    return { orders: rows, total: count };
  }

  async FindById(id: number): Promise<Order | null> {
    const logger = GetLogger();
    logger?.debug('OrderRepository.FindById - Executing query', { id });
    const order = await Order.findByPk(id, {
      include: [
        { association: 'creator', attributes: ['id', 'name', 'email'] },
        { association: 'store', attributes: ['id', 'name', 'store_code'] },
        {
          association: 'orderItems',
          attributes: ['id', 'product_id', 'quantity', 'total_price'],
          include: [
            { association: 'product', attributes: ['id', 'name', 'sku', 'selling_price'] },
          ],
        },
      ],
    });
    logger?.debug('OrderRepository.FindById - Query completed', { id, found: !!order });
    return order;
  }

  async Create(data: OrderCreationAttributes, items: OrderItemCreationAttributes[]): Promise<Order> {
    const logger = GetLogger();
    logger?.debug('OrderRepository.Create - Executing query', { invoice_number: data.invoice_number });
    
    // Use transaction to ensure atomicity
    const transaction = await sequelize.transaction();
    
    try {
      const order = await Order.create(data, { transaction });
      
      // Create order items
      const orderItemsData = items.map(item => ({
        ...item,
        order_id: order.id,
      }));
      await OrderItem.bulkCreate(orderItemsData, { transaction });
      
      await transaction.commit();
      
      // Reload with associations
      await order.reload({
        include: [
          { association: 'creator', attributes: ['id', 'name', 'email'] },
          {
            association: 'orderItems',
            attributes: ['id', 'product_id', 'quantity', 'total_price'],
            include: [
              { association: 'product', attributes: ['id', 'name', 'sku', 'selling_price'] },
            ],
          },
        ],
      });
      
      logger?.info('OrderRepository.Create - Query completed', { id: order.id, invoice_number: order.invoice_number });
      return order;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

}

