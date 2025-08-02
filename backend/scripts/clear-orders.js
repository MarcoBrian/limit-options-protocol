const { clearOrders } = require('../database/db');

async function clearAllOrders() {
  console.log('🗑️ Clearing all orders from database...');
  
  try {
    await clearOrders();
    console.log('✅ All orders cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing orders:', error.message);
  }
}

clearAllOrders(); 