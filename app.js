const express = require('express');
const app = express();
const ejs = require('ejs');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const methodOverride = require('method-override');

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Sangam@2024',
    database: 'canteen'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database.');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(methodOverride('_method'));
app.use(express.urlencoded({extended:true}));
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Passport Local Strategy
passport.use(new LocalStrategy({
    usernameField: 'employee_code',
    passwordField: 'password'
}, (employee_code, password, done) => {
    db.query('SELECT * FROM users WHERE employee_code = ?', [employee_code], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            return done(null, false, { message: 'Incorrect employee code.' });
        }
        const user = results[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) throw err;
            if (isMatch) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Incorrect password.' });
            }
        });
    });
}));
// Passport Local Strategy for Admin
passport.use('admin', new LocalStrategy({
    usernameField: 'employee_code',
    passwordField: 'password'
}, (employee_code, password, done) => {
    db.query('SELECT * FROM users WHERE employee_code = ?', [employee_code], (err, results) => {
        if (err) throw err;
        
        if (results.length === 0) {
            return done(null, false, { message: 'Incorrect employee code.' });
        }
        
        const user = results[0];

        // Check if the user is an admin
        if (!user.is_admin) {
            return done(null, false, { message: 'You are not authorized to access this page.' });
        }

        // Compare passwords
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) throw err;
            if (isMatch) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Incorrect password.' });
            }
        });
    });
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
        if (err) throw err;
        done(null, results[0]);
    });
});

// Routes
app.get('/login', (req, res) => {
    res.render('login', { message: req.flash('error') });
});

app.get('/register', (req, res) => {
    res.render('register');
});
app.get('/admin-login', (req, res) => {
    res.render('admin-login', { message: req.flash('error') });
});

app.post('/admin-login', passport.authenticate('admin', {
    successRedirect: '/admin-dashboard',
    failureRedirect: '/admin-login',
    failureFlash: true
}));

app.post('/register', (req, res) => {
    const { employee_code, employee_name,department,designation, email, password, isAdmin } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const isAdminFlag = isAdmin === 'on' ? true : false;

    db.query('INSERT INTO users (employee_code, employee_name,department,designation, email, password, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [employee_code, employee_name,department,designation, email, hashedPassword, isAdminFlag], (err, result) => {
        if (err) throw err;
        res.redirect('/login');
    });
});

app.get('/admin-register', (req, res) => {
    if (req.isAuthenticated() && req.user.is_admin) {
        res.render('admin-register.ejs');
    } else {
        res.redirect('/login');
    }
});

app.get('/rate-list', (req, res) => {
   res.render("rate-list.ejs");
});
app.get("/edit-item-form",(req,res)=>{
    const {id} = req.body;
    res.render("edit-item-form.ejs", {id})
})

// edit route
app.get("/edit-item-form/:id",(req,res)=>{
    let {id} = req.params;
    let q = `SELECT * FROM RateList WHERE id='${id}'`;
    try{
        db.query(q,(err,result)=>{
            if(err) throw err;
            let user = result[0]
            res.render("edit-item-form.ejs" ,{user});
        });
    } catch(err){
        console.log(err);
        res.send("some error in db");
    }
    
})

//update route
app.put("/view-rate-list/:id",(req,res)=>{
    let {id} = req.params;
    let{item : item , rate : rate, date_from : date_from, date_to : date_to} = req.body;
    let q = `SELECT * FROM RateList WHERE id='${id}'`;
    try{
        db.query(q,(err,result)=>{
            if(err) throw err;
            let user = result[0]
          let q2 = `UPDATE RateList SET item='${item}',rate='${rate}', date_from='${date_from}', date_to='${date_to}'WHERE id='${id}'`;
          try{
            db.query(q2,(err,result)=>{
                if(err) throw err;
                // let user = result[0]
                // res.render("edit-item-form.ejs" ,{user});
                res.redirect('/view-rate-list');
            });
        } catch(err){
            console.log(err);
            res.send("some error in db");
        }
        });
    } catch(err){
        console.log(err);
        res.send("some error in db");
    }
})

app.get('/view-rate-list', (req, res) => {
    const sql = 'SELECT * FROM RateList';

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
        // Render the view-rate-list.ejs template with rateList data
        res.render('view-rate-list', { rateList: results });
    });
}); 

app.post('/submit-rate-list', (req, res) => {
    const { item, rate, date_from, date_to } = req.body;
    const sql = 'INSERT INTO RateList (item, rate, date_from, date_to) VALUES (?, ?, ?, ?)';
    const values = [item, rate, date_from, date_to];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error inserting data into database:', err);
            return res.status(500).send('Internal Server Error');
        }
       // console.log('Data inserted successfully:', result);
        res.redirect('/admin-dashboard');
    });
});

app.post('/admin-register', (req, res) => {
    if (req.isAuthenticated() && req.user.is_admin) {
        const { employee_code, employee_name, email, password } = req.body;
        const hashedPassword = bcrypt.hashSync(password, 10);

        db.query('INSERT INTO users (employee_code, employee_name, email, password, is_admin) VALUES (?, ?, ?, ?, true)', 
            [employee_code, employee_name, email, hashedPassword], (err, result) => {
            if (err) throw err;
            res.redirect('/admin-dashboard');
        });
    } else {
        res.redirect('/login');
    }
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true
}));

// API endpoint to fetch employee details
app.get('/api/employee-details', (req, res) => {
    const userId = req.user.id;
    
    db.query('SELECT employee_code, employee_name, department, designation FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
            console.error('Error fetching employee details: ', err);
            return res.status(500).send('Internal server error');
        }
        
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Employee not found');
        }
    });
});

app.get('/dashboard', (req, res) => {
    if (req.isAuthenticated()) {
        const userId = req.user.id;

        // Query the database for employees and guests belonging to the logged-in user
        db.query('SELECT * FROM employees WHERE user_id = ?', [userId], (err, employeesResults) => {
            if (err) throw err;

            db.query('SELECT * FROM guests WHERE user_id = ?', [userId], (err, guestsResults) => {
                if (err) throw err;

                // Render the dashboard template with the retrieved data
                res.render('dashboard', {
                    user: req.user,
                    employees: employeesResults,
                    guests: guestsResults
                });
            });
        });
    } else {
        res.redirect('/login');
    }
});
app.get('/admin-dashboard', (req, res) => {
    if (req.isAuthenticated() && req.user.is_admin) {
        // Query the database for all employees and guests
        db.query('SELECT * FROM employees', (err, employeesResults) => {
            if (err) {
                console.error('Error fetching employees:', err);
                throw err; // Handle errors appropriately
            }

            db.query('SELECT * FROM guests', (err, guestsResults) => {
                if (err) {
                    console.error('Error fetching guests:', err);
                    throw err; // Handle errors appropriately
                }

                // Render the admin dashboard template with the retrieved data
                res.render('admin-dashboard', {
                    user: req.user,
                    employees: employeesResults,
                    guests: guestsResults
                });
            });
        });
    } else {
        res.redirect('/admin-login'); // Redirect to admin login if not authenticated or not admin
    }
});

app.get('/logout', (req, res) => {
    req.logout(err => {
        if (err) {
            return next(err);
        }
        res.redirect('/login');
    });
});


app.post('/add-guest', (req, res) => {
    const { orders, employee_name, guestName, guestCompany, guestdesignation, remarks, dateFromGuest, dateToGuest } = req.body;
    const userId = req.user.id; // Assuming req.user.id contains the user's ID

    const startDate = new Date(dateFromGuest);
    const endDate = new Date(dateToGuest);

    let currentDate = startDate;
    const entries = [];

    while (currentDate <= endDate) {
        const entry = [
            orders,
            employee_name,
            guestName,
            guestCompany,
            guestdesignation,
            remarks,
            currentDate.toISOString().split('T')[0], // date_from
            currentDate.toISOString().split('T')[0], // date_to
            userId
        ];
        entries.push(entry);

        // Increment the date by one day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    const checkSql = `SELECT * FROM guests WHERE 
                      orders = ? AND employee_name = ? AND guestName = ? AND guestCompany = ? AND guestdesignation = ? AND 
                      (date_from BETWEEN ? AND ? OR date_to BETWEEN ? AND ?)`;

    db.query(checkSql, [orders, employee_name, guestName, guestCompany, guestdesignation, dateFromGuest, dateToGuest, dateFromGuest, dateToGuest], (err, results) => {
        if (err) {
            console.error('Error checking for duplicates:', err);
            return res.status(500).json({ error: 'An error occurred while checking for duplicates.' });
        }

        if (results.length > 0) {
            // Duplicate entries found
            return res.status(400).json({ error: 'A similar entry already exists in the database. Please check your input.' });
        }

        const insertSql = 'INSERT INTO guests (orders, employee_name, guestName, guestCompany, guestdesignation, remarks, date_from, date_to, user_id) VALUES ?';

        db.query(insertSql, [entries], (err, result) => {
            if (err) {
                console.error('Error inserting entries:', err);
                return res.status(500).json({ error: 'An error occurred while creating entries.' });
            }
           res.redirect("/dashboard");
        });
    });
});


app.post('/add-employee', (req, res) => {
    const { employeeName, employeeCode, department, designation, orders, dateFromEmployee, dateToEmployee } = req.body;
    const userId = req.user.id; // Assuming req.user.id contains the user's ID

    const startDate = new Date(dateFromEmployee);
    const endDate = new Date(dateToEmployee);

    let currentDate = startDate;
    const entries = [];

    while (currentDate <= endDate) {
        const entry = [
            employeeName,
            employeeCode,
            department,
            designation,
            orders,
            currentDate.toISOString().split('T')[0], // date_from
            currentDate.toISOString().split('T')[0], // date_to
            userId
        ];
        entries.push(entry);

        // Increment the date by one day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    const checkSql = `SELECT * FROM employees WHERE 
                      name = ? AND employeeCode = ? AND department = ? AND designation = ? AND orders = ? AND 
                      (date_from BETWEEN ? AND ? OR date_to BETWEEN ? AND ?)`;

    db.query(checkSql, [employeeName, employeeCode, department, designation, orders, dateFromEmployee, dateToEmployee, dateFromEmployee, dateToEmployee], (err, results) => {
        if (err) {
            console.error('Error checking for duplicates:', err);
            return res.status(500).send({ error: 'An error occurred while checking for duplicates.' });
        }

        if (results.length > 0) {
            // Duplicate entries found
            return res.status(400).send({ error: 'A similar entry already exists in the database. Please check your input.' });
        }

        const insertSql = 'INSERT INTO employees (name, employeeCode, department, designation, orders, date_from, date_to, user_id) VALUES ?';

        db.query(insertSql, [entries], (err, result) => {
            if (err) {
                console.error('Error inserting entries:', err);
                return res.status(500).send({ error: 'An error occurred while creating entries.' });
            }
            res.redirect('/dashboard');
        });
    });
});


// Start server
const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
