const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db;

function getDatabase() {
  if (!db) {
    const dbPath = path.join(__dirname, '../data/orders.db');
    
    // Ensure the data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`✅ Created data directory: ${dataDir}`);
    }
    
    console.log(`🔧 Database path: ${dbPath}`);
    console.log(`🔧 Data directory: ${dataDir}`);
    console.log(`🔧 Directory exists: ${fs.existsSync(dataDir)}`);
    
    try {
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('❌ Error opening database:', err);
          console.error('❌ Database path:', dbPath);
          console.error('❌ Current directory:', process.cwd());
          console.error('❌ __dirname:', __dirname);
        } else {
          console.log(`✅ Database opened successfully: ${dbPath}`);
        }
      });
      
      // Enable WAL mode for better concurrency
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA synchronous = NORMAL');
      db.run('PRAGMA cache_size = 10000');
      db.run('PRAGMA temp_store = MEMORY');
      
      // Set busy timeout to handle concurrent access
      db.configure('busyTimeout', 30000); // 30 seconds
      
    } catch (error) {
      console.error('❌ Error creating database connection:', error);
      throw error;
    }
  }
  return db;
}

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    // Create orders table
    const createOrdersTable = `
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_hash TEXT UNIQUE NOT NULL,
        maker TEXT NOT NULL,
        maker_asset TEXT NOT NULL,
        taker_asset TEXT NOT NULL,
        making_amount TEXT NOT NULL,
        taking_amount TEXT NOT NULL,
        salt TEXT NOT NULL,
        receiver TEXT NOT NULL,
        maker_traits TEXT NOT NULL,
        order_data TEXT NOT NULL,
        signature TEXT NOT NULL,
        option_params TEXT,
        options_nft_signature_r TEXT,
        options_nft_signature_s TEXT,
        options_nft_signature_v TEXT,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create index for faster queries
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_maker ON orders(maker);
      CREATE INDEX IF NOT EXISTS idx_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_created_at ON orders(created_at);
    `;

    database.serialize(() => {
      database.run(createOrdersTable, (err) => {
        if (err) {
          console.error('Error creating orders table:', err);
          reject(err);
          return;
        }
        
        database.run(createIndexes, (err) => {
          if (err) {
            console.error('Error creating indexes:', err);
            reject(err);
            return;
          }
          
          console.log('✅ Database tables and indexes created successfully');
          resolve();
        });
      });
    });
  });
}

async function insertOrder(orderData) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    const {
      orderHash,
      maker,
      makerAsset,
      takerAsset,
      makingAmount,
      takingAmount,
      salt,
      receiver,
      makerTraits,
      orderData: orderDataObj,
      signature,
      optionParams,
      optionsNFTSignature
    } = orderData;

    const query = `
      INSERT INTO orders (
        order_hash, maker, maker_asset, taker_asset, making_amount, 
        taking_amount, salt, receiver, maker_traits, order_data, 
        signature, option_params, options_nft_signature_r, options_nft_signature_s, options_nft_signature_v
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      orderHash,
      maker,
      makerAsset,
      takerAsset,
      makingAmount,
      takingAmount,
      salt,
      receiver,
      makerTraits,
      JSON.stringify(orderDataObj),
      signature,
      optionParams ? JSON.stringify(optionParams) : null,
      optionsNFTSignature?.r || null,
      optionsNFTSignature?.s || null,
      optionsNFTSignature?.v || null
    ];

    const executeInsert = (retryCount = 0) => {
      database.run(query, params, function(err) {
        if (err) {
          if (err.code === 'SQLITE_BUSY' && retryCount < 3) {
            console.log(`⚠️ Database busy, retrying insert (attempt ${retryCount + 1}/3)...`);
            setTimeout(() => executeInsert(retryCount + 1), 1000 * (retryCount + 1));
          } else {
            console.error('❌ Error storing order:', err);
            reject(err);
          }
        } else {
          console.log(`✅ Order stored successfully: ${orderHash}`);
          resolve({ id: this.lastID, orderHash });
        }
      });
    };

    executeInsert();
  });
}

async function getOrders(filters = {}) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.maker) {
      query += ' AND maker = ?';
      params.push(filters.maker);
    }

    if (filters.makerAsset) {
      query += ' AND maker_asset = ?';
      params.push(filters.makerAsset);
    }

    if (filters.takerAsset) {
      query += ' AND taker_asset = ?';
      params.push(filters.takerAsset);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    database.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        // Parse JSON fields
        const orders = rows.map(row => ({
          ...row,
          orderData: JSON.parse(row.order_data),
          optionParams: row.option_params ? JSON.parse(row.option_params) : null
        }));
        resolve(orders);
      }
    });
  });
}

async function getOrderByHash(orderHash) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    const query = 'SELECT * FROM orders WHERE order_hash = ?';
    
    database.get(query, [orderHash], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        resolve(null);
      } else {
        // Parse JSON fields
        const order = {
          ...row,
          orderData: JSON.parse(row.order_data),
          optionParams: row.option_params ? JSON.parse(row.option_params) : null
        };
        resolve(order);
      }
    });
  });
}

async function updateOrderStatus(orderHash, status) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    const query = `
      UPDATE orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE order_hash = ?
    `;
    
    database.run(query, [status, orderHash], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes });
      }
    });
  });
}

async function deleteOrder(orderHash) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    const deleteQuery = 'DELETE FROM orders WHERE order_hash = ?';
    
    database.run(deleteQuery, [orderHash], function(err) {
      if (err) {
        console.error('Error deleting order:', err);
        reject(err);
        return;
      }
      
      console.log(`✅ Order deleted: ${orderHash}`);
      resolve({ deleted: this.changes > 0 });
    });
  });
}

async function clearOrders() {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    const clearQuery = 'DELETE FROM orders';
    
    database.run(clearQuery, function(err) {
      if (err) {
        console.error('Error clearing orders:', err);
        reject(err);
        return;
      }
      
      console.log(`✅ Cleared ${this.changes} orders from database`);
      resolve({ cleared: this.changes });
    });
  });
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('✅ Database connection closed');
      }
    });
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  closeDatabase();
  process.exit(0);
});

module.exports = {
  getDatabase,
  initializeDatabase,
  insertOrder,
  getOrders,
  getOrderByHash,
  updateOrderStatus,
  deleteOrder,
  clearOrders,
  closeDatabase
}; 