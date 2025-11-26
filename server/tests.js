
const mysql = require('mysql2/promise');

const dbConfig = {
  host: '34.93.93.125',
  port: 3306,
  user: 'root',
  password: 'k6A*tSYI3xQkIdQp',
  database: 'app-instuto-com',
  connectTimeout: 10000
};

// Test Data Constants
const TEST_BOOK_ID = 'test-book-001';
const TEST_COPY_ID = 'test-copy-001';
const TEST_USER_ID = 'test-user-001';
const TEST_TX_ID = 'test-tx-001';

async function runTests() {
  console.log('\n🧪 Starting Instuto Integration Tests...\n');
  let connection;
  let passed = 0;
  let total = 0;

  const assert = (label, condition, errorMsg) => {
    total++;
    if (condition) {
        console.log(`✅ [PASS] ${label}`);
        passed++;
    } else {
        console.error(`❌ [FAIL] ${label}`);
        if (errorMsg) console.error(`   -> ${errorMsg}`);
    }
  };

  try {
    // --- SETUP ---
    connection = await mysql.createConnection(dbConfig);
    console.log('--- 1. System Health ---');
    assert('Database Connection', true);

    // Schema Check
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    const requiredTables = ['system_users', 'users', 'books', 'copies', 'transactions', 'logs', 'settings'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));
    assert('Schema Integrity', missingTables.length === 0, `Missing: ${missingTables.join(', ')}`);

    // --- CLEANUP (Pre-test) ---
    await connection.query('DELETE FROM transactions WHERE id = ?', [TEST_TX_ID]);
    await connection.query('DELETE FROM copies WHERE id = ?', [TEST_COPY_ID]);
    await connection.query('DELETE FROM books WHERE id = ?', [TEST_BOOK_ID]);
    await connection.query('DELETE FROM users WHERE id = ?', [TEST_USER_ID]);

    // --- CATALOG TESTS ---
    console.log('\n--- 2. Catalog Management ---');
    
    // Create Book
    await connection.query(
        `INSERT INTO books (id, title, authors, categories, isbn, genre, publisher, published_year, location_rack, location_shelf, loc_call_number) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [TEST_BOOK_ID, 'Test Driven Development', JSON.stringify(['Kent Beck']), JSON.stringify(['Technology']), '9780321146533', 'Tech', 'Addison-Wesley', '2002', 'A1', '01', 'QA76 .B43']
    );
    
    const [books] = await connection.query('SELECT * FROM books WHERE id = ?', [TEST_BOOK_ID]);
    assert('Create Book', books.length === 1 && books[0].title === 'Test Driven Development');

    // Add Copy
    await connection.query(
        `INSERT INTO copies (id, book_id, status, added_date, is_reference_only) VALUES (?, ?, ?, NOW(), 0)`,
        [TEST_COPY_ID, TEST_BOOK_ID, 'AVAILABLE']
    );
    const [copies] = await connection.query('SELECT * FROM copies WHERE id = ?', [TEST_COPY_ID]);
    assert('Add Copy', copies.length === 1 && copies[0].status === 'AVAILABLE');

    // --- USER TESTS ---
    console.log('\n--- 3. User Management ---');
    await connection.query(
        `INSERT INTO users (id, name, role, email) VALUES (?, ?, ?, ?)`,
        [TEST_USER_ID, 'Test Student', 'Student', 'student@test.com']
    );
    const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [TEST_USER_ID]);
    assert('Create Borrower', users.length === 1);

    // --- CIRCULATION TESTS ---
    console.log('\n--- 4. Circulation Flow ---');
    
    // Issue Book
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    
    await connection.query(
        `INSERT INTO transactions (id, copy_id, book_id, user_id, user_name, issue_date, due_date, status) 
         VALUES (?, ?, ?, ?, ?, NOW(), ?, 'ACTIVE')`,
        [TEST_TX_ID, TEST_COPY_ID, TEST_BOOK_ID, TEST_USER_ID, 'Test Student', dueDate]
    );
    
    // Update copy status to borrowed
    await connection.query('UPDATE copies SET status = "BORROWED" WHERE id = ?', [TEST_COPY_ID]);

    const [txActive] = await connection.query('SELECT * FROM transactions WHERE id = ?', [TEST_TX_ID]);
    const [copyBorrowed] = await connection.query('SELECT * FROM copies WHERE id = ?', [TEST_COPY_ID]);
    
    assert('Issue Book (Transaction Created)', txActive.length === 1 && txActive[0].status === 'ACTIVE');
    assert('Issue Book (Copy Status Updated)', copyBorrowed[0].status === 'BORROWED');

    // Return Book
    await connection.query(
        'UPDATE transactions SET status="RETURNED", return_date=NOW(), return_condition="GOOD" WHERE id=?',
        [TEST_TX_ID]
    );
    await connection.query('UPDATE copies SET status="AVAILABLE" WHERE id=?', [TEST_COPY_ID]);

    const [txReturned] = await connection.query('SELECT * FROM transactions WHERE id = ?', [TEST_TX_ID]);
    const [copyAvailable] = await connection.query('SELECT * FROM copies WHERE id = ?', [TEST_COPY_ID]);

    assert('Return Book (Transaction Closed)', txReturned[0].status === 'RETURNED');
    assert('Return Book (Copy Available)', copyAvailable[0].status === 'AVAILABLE');

  } catch (err) {
    console.error('\n⚠️  Critical Test Failure:', err.message);
  } finally {
    // --- TEARDOWN ---
    console.log('\n--- 5. Cleanup ---');
    if (connection) {
        try {
            await connection.query('DELETE FROM transactions WHERE id = ?', [TEST_TX_ID]);
            await connection.query('DELETE FROM copies WHERE id = ?', [TEST_COPY_ID]);
            await connection.query('DELETE FROM books WHERE id = ?', [TEST_BOOK_ID]);
            await connection.query('DELETE FROM users WHERE id = ?', [TEST_USER_ID]);
            console.log('✅ Test data removed.');
        } catch (e) {
            console.error('❌ Cleanup failed:', e.message);
        }
        await connection.end();
    }
    
    console.log('\n----------------------------------------');
    console.log(`Summary: ${passed}/${total} Passed`);
    console.log('----------------------------------------\n');
    
    if (passed === total && total > 0) {
        process.exit(0);
    } else {
        process.exit(1);
    }
  }
}

runTests();
