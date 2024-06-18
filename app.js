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
    const { employee_code, employee_name, email, password, isAdmin } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const isAdminFlag = isAdmin === 'on' ? true : false;

    db.query('INSERT INTO users (employee_code, employee_name, email, password, is_admin) VALUES (?, ?, ?, ?, ?)', 
        [employee_code, employee_name, email, hashedPassword, isAdminFlag], (err, result) => {
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
    const { guestName, personToAddGuest, guestCompany, dateFromGuest, dateToGuest } = req.body;
    const sql = 'INSERT INTO guests (name, person_to_add, company, date_from, date_to, user_id) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [guestName, personToAddGuest, guestCompany, dateFromGuest, dateToGuest, req.user.id], (err, result) => {
        if (err) throw err;
        res.redirect('/dashboard');
    });
});

app.post('/add-employee', (req, res) => {
    const { employeeName, personToAddEmployee, dateFromEmployee, dateToEmployee } = req.body;
    const sql = 'INSERT INTO employees (name, person_to_add, date_from, date_to, user_id) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [employeeName, personToAddEmployee, dateFromEmployee, dateToEmployee, req.user.id], (err, result) => {
        if (err) throw err;
        res.redirect('/dashboard');
    });
});

// Start server
const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
