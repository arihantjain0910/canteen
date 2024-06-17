const express = require('express');
const app = express();
const ejs = require('ejs');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Replace with your MySQL username
    password: 'Sangam@2024', // Replace with your MySQL password
    database: 'canteen' // Replace with your MySQL database name
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database.');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');



app.get("/login",(req,res)=>{
    res.render("loginPage.ejs")
})
// Routes
app.get('/dashboard', (req, res) => {
    const sqlGuests = 'SELECT * FROM guests';
    const sqlEmployees = 'SELECT * FROM employees';

    db.query(sqlGuests, (err, guests) => {
        if (err) throw err;

        db.query(sqlEmployees, (err, employees) => {
            if (err) throw err;

            res.render('dashboard', { guests, employees });
        });
    });
});

app.post('/add-guest', (req, res) => {
    const { guestName, personToAddGuest, guestCompany, dateFromGuest, dateToGuest } = req.body;
    const sql = 'INSERT INTO guests (name, person_to_add, company, date_from, date_to) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [guestName, personToAddGuest, guestCompany, dateFromGuest, dateToGuest], (err, result) => {
        if (err) throw err;
        res.redirect('/dashboard');
    });
});

app.post('/add-employee', (req, res) => {
    const { employeeName, personToAddEmployee, dateFromEmployee, dateToEmployee } = req.body;
    const sql = 'INSERT INTO employees (name, person_to_add, date_from, date_to) VALUES (?, ?, ?, ?)';
    db.query(sql, [employeeName, personToAddEmployee, dateFromEmployee, dateToEmployee], (err, result) => {
        if (err) throw err;
        res.redirect('/dashboard');
    });
});

// Start server
const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
