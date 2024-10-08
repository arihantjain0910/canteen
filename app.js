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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Sangam@2024',
    database: 'canteen',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    
  });

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection:', err);
      return;
    }
  
    // Use the connection
    pool.query('SELECT * FROM users', (error, results) => {
      connection.release(); // Release the connection back to the pool
  
      if (error) {
       // console.error('Error executing query:', error);
        return;
      }
  
     // console.log('Query results:', results);
    });
  });


// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
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
app.use((req, res, next) => {
    res.locals.error = req.flash('error');
    next();
  });

// Passport Local Strategy
passport.use(new LocalStrategy({
    usernameField: 'employee_code',
    passwordField: 'password'
}, (employee_code, password, done) => {
    
    pool.query('SELECT * FROM users WHERE employee_code = ?', [employee_code], (err, results) => {
        if (err) {
            console.error('Error retrieving user:', err);
            return done(err);
        }
        if (results.length === 0) {
            return done(null, false, { message: 'Incorrect employee code.' });
        }
        const user = results[0];
        // Compare plain text passwords
        if (password !== user.password) {
            return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
    });
}));

// Passport Local Strategy for Admin
passport.use('admin', new LocalStrategy({
    usernameField: 'employee_code',
    passwordField: 'password'
}, (employee_code, password, done) => {
    pool.query('SELECT * FROM users WHERE employee_code = ?', [employee_code], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return done(err);
        }

        if (results.length === 0) {
            console.log('Admin login: Incorrect employee code.');
            return done(null, false, { message: 'Incorrect employee code.' });
        }

        const user = results[0];

        // Check if the user is an admin
        if (!user.is_admin) {
            console.log('Admin login: Not an admin.');
            return done(null, false, { message: 'You are not authorized to access this page.' });
        }

        // Compare plain text passwords
        if (password !== user.password) {
           console.log('Admin login: Incorrect password.');
            return done(null, false, { message: 'Incorrect password.' });
        }

      console.log('Admin login: Success.');
        return done(null, user);
    });
}));


passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    pool.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
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
    const { employee_code, employee_name, department, designation, email, password, isAdmin } = req.body;
    // Remove hashing of password
    // const hashedPassword = bcrypt.hashSync(password, 10);
    const isAdminFlag = isAdmin === 'on' ? true : false;

    // Use plain text password directly
    pool.query('INSERT INTO users (employee_code, employee_name, department, designation, email, password, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [employee_code, employee_name, department, designation, email, password, isAdminFlag], (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/login');
    });
});

// Passport Local Strategy for Store
passport.use('store', new LocalStrategy({
    usernameField: 'employee_code',
    passwordField: 'password'
}, (employee_code, password, done) => {
    pool.query('SELECT * FROM users WHERE employee_code = ?', [employee_code], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return done(err);
        }

        if (results.length === 0) {
            console.log('Store login: Incorrect employee code.');
            return done(null, false, { message: 'Incorrect employee code.' });
        }

        const user = results[0];

        // Check if the user is a store user
        if (!user.is_store) {
            console.log('Store login: Not a store user.');
            return done(null, false, { message: 'You are not authorized to access this page.' });
        }

        // Compare plain text passwords
        if (password !== user.password) {
            console.log('Store login: Incorrect password.');
            return done(null, false, { message: 'Incorrect password.' });
        }

        console.log('Store login: Success.');
        return done(null, user);
    });
}));

// Routes for store login
app.get('/store-login', (req, res) => {
    res.render('store-login', { message: req.flash('error') });
});

app.post('/store-login', passport.authenticate('store', {
    successRedirect: '/store-dashboard',
    failureRedirect: '/store-login',
    failureFlash: true
}));

app.get('/store-dashboard', (req, res) => {
    res.render('store-dashboard', { user: req.user });
});




app.get('/admin-register', (req, res) => {
    if (req.isAuthenticated() && req.user.is_admin) {
        res.render('admin-register.ejs');
    } else {
        res.redirect('/login');
    }
});


app.get("/view-menu",(req,res)=>{
    let q = "SELECT * FROM RateList";
    try{
        pool.query(q,(err,result)=>{
            if(err) throw err;
            let menu = result;
            res.render("view-menu.ejs" ,{menu});
        });
    } catch(err){
        console.log(err);
        res.send("some error in db");
    }

    
})

app.get('/rate-list', (req, res) => {
   res.render("rate-list.ejs");
});
app.get("/edit-item-form",(req,res)=>{
    const {id} = req.body;
    res.render("edit-item-form.ejs", {id})
})

app.delete("/delete-item/:id",(req,res)=>{
    let {id} = req.params;
    let q = `DELETE FROM RateList WHERE id='${id}'`;
    try{
        pool.query(q,(err,result)=>{
            if(err) throw err;
            // let user = result[0]
            res.redirect("/view-rate-list");
        });
    } catch(err){
        console.log(err);
        res.send("some error in db");
    }
})


// edit route
app.get("/edit-item-form/:id",(req,res)=>{
    let {id} = req.params;
    let q = `SELECT * FROM RateList WHERE id='${id}'`;
    try{
        pool.query(q,(err,result)=>{
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
app.put("/view-rate-list/:id", (req, res) => {
    let { id } = req.params;
    let { day, breakfast, breakfast_price, lunch, lunch_price, date } = req.body;
    
    let q = `SELECT * FROM RateList WHERE id = ?`;
    
    pool.query(q, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.send("Some error in db");
        }
        
        if (result.length === 0) {
            return res.send("No record found with the given id");
        }

        let q2 = `UPDATE RateList SET day = ?, breakfast = ?, breakfast_price = ?, lunch = ?, lunch_price = ?, date = ? WHERE id = ?`;
        
        pool.query(q2, [day, breakfast, breakfast_price, lunch, lunch_price, date, id], (err, result) => {
            if (err) {
                console.error(err);
                return res.send("Some error in db");
            }
            
            res.redirect('/view-rate-list');
        });
    });
});

app.get('/view-rate-list', (req, res) => {
    const sql = 'SELECT * FROM RateList';

    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
        // Render the view-rate-list.ejs template with rateList data
        res.render('view-rate-list', { rateList: results });
    });
}); 

app.post('/submit-rate-list', (req, res) => {
    const { day,breakfast,breakfast_price,lunch,lunch_price,date } = req.body;
    const sql = 'INSERT INTO RateList (day,breakfast,breakfast_price,lunch,lunch_price,date) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [day,breakfast,breakfast_price,lunch,lunch_price,date];

    pool.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error inserting data into database:', err);
            return res.status(500).send('Internal Server Error');
        }
       // console.log('Data inserted successfully:', result);
        res.redirect('/view-rate-list');
    });
});

app.post('/admin-register', (req, res) => {
    if (req.isAuthenticated() && req.user.is_admin) {
        const { employee_code, employee_name, email, password } = req.body;
        const hashedPassword = bcrypt.hashSync(password, 10);

        pool.query('INSERT INTO users (employee_code, employee_name, email, password, is_admin) VALUES (?, ?, ?, ?, true)', 
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
    
    pool.query('SELECT employee_code, employee_name, department, designation FROM users WHERE id = ?', [userId], (err, results) => {
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
        pool.query('SELECT * FROM employees WHERE user_id = ?', [userId], (err, employeesResults) => {
            if (err) throw err;

            pool.query('SELECT * FROM guests WHERE user_id = ?', [userId], (err, guestsResults) => {
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
        pool.query('SELECT * FROM employees', (err, employeesResults) => {
            if (err) {
                console.error('Error fetching employees:', err);
                throw err; // Handle errors appropriately
            }

            pool.query('SELECT * FROM guests', (err, guestsResults) => {
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

app.delete('/delete-entry/:id',(req,res)=>{
    let {id} = req.params;
    let q = `DELETE FROM employees WHERE id='${id}'`;
    try{
        pool.query(q,(err,result)=>{
            if(err) throw err;
            // let user = result[0]
            res.redirect("/admin-dashboard");
        });
    } catch(err){
        console.log(err);
        res.send("some error in db");
    }
})

app.get('/logout', (req, res) => {
    req.logout(err => {
        if (err) {
            return next(err);
        }
        res.redirect('/login');
    });
});
app.get('/store-logout', (req, res) => {
    req.logout(err => {
        if (err) {
            return next(err);
        }
        res.redirect('/store-login');
    });
});

app.get('/admin-logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error during logout:', err);
            return next(err);
        }
        res.redirect('/admin-login');
    });
});
app.get("/add-new-employee",(req,res)=>{
    res.render("add-employee.ejs")
})
app.post("/add-new-employee",(req,res)=>{
    const{employee_name,employee_code,department,designation,email,password} = req.body;
    let q = "INSERT INTO users (employee_name,employee_code,department,designation,email,password,is_admin) VALUES (?,?,?,?,?,?,FALSE) ";
    pool.query(q, 
        [employee_name, employee_code, department, designation, email, password], (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/admin-dashboard');
    });

})

app.get('/view-users', (req, res) => {
    const sql = 'SELECT * FROM users';

    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
        // Render the view-rate-list.ejs template with rateList data
        res.render('all-users', { users: results });
    });
}); 

app.post('/add-guest', (req, res) => {
    const { orders, employee_name, guestName, guestCompany, guestdesignation, remarks, dateFromGuest, dateToGuest } = req.body;
    const userId = req.user.id; // Assuming req.user.id contains the user's ID

    const startDate = new Date(dateFromGuest);
    const endDate = new Date(dateToGuest);

    let currentDate = startDate;
    const entries = [];

    const now = new Date();
    const isBefore1030AM = now.getHours() < 10 || (now.getHours() === 10 && now.getMinutes() < 30);

    while (currentDate <= endDate) {
        if (!(currentDate.toDateString() === now.toDateString() && !isBefore1030AM)) {
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
        }

        // Increment the date by one day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    const checkSql = `SELECT * FROM guests WHERE 
                      orders = ? AND employee_name = ? AND guestName = ? AND guestCompany = ? AND guestdesignation = ? AND 
                      (date_from BETWEEN ? AND ? OR date_to BETWEEN ? AND ?)`;

    pool.query(checkSql, [orders, employee_name, guestName, guestCompany, guestdesignation, dateFromGuest, dateToGuest, dateFromGuest, dateToGuest], (err, results) => {
        if (err) {
            console.error('Error checking for duplicates:', err);
            return res.status(500).json({ error: 'An error occurred while checking for duplicates.' });
        }

        if (results.length > 0) {
            // Duplicate entries found
            return res.status(400).json({ error: 'A similar entry already exists in the database. Please check your input.' });
        }

        if (entries.length === 0) {
            return res.status(400).json({ error: 'No entries to insert based on the provided criteria.' });
        }

        const insertSql = 'INSERT INTO guests (orders, employee_name, guestName, guestCompany, guestdesignation, remarks, date_from, date_to, user_id) VALUES ?';

        pool.query(insertSql, [entries], (err, result) => {
            if (err) {
                console.error('Error inserting entries:', err);
                return res.status(500).json({ error: 'An error occurred while creating entries.' });
            }
            res.redirect('/dashboard');
        });
    });
});



app.post('/add-employee', (req, res) => {
    const { employeeName, employeeCode, department, designation, orders,quantity, dateFromEmployee, dateToEmployee } = req.body;
    const userId = req.user.id; // Assuming req.user.id contains the user's ID



    const startDate = new Date(dateFromEmployee);
    const endDate = new Date(dateToEmployee);

    let currentDate = startDate;
    const entries = [];

    const now = new Date();
    const isBefore1030AM = now.getHours() < 10 || (now.getHours() === 10 && now.getMinutes() < 30);

    while (currentDate <= endDate) {
        if (!(currentDate.toDateString() === now.toDateString() && !isBefore1030AM)) {
            const entry = [
                employeeName,
                employeeCode,
                department,
                designation,
                orders,
                quantity,
                currentDate.toISOString().split('T')[0], // date_from
                currentDate.toISOString().split('T')[0], // date_to
                userId,
                
            ];
            entries.push(entry);
        }

        // Increment the date by one day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    const checkSql = `SELECT * FROM employees WHERE 
                      name = ? AND employeeCode = ? AND department = ? AND designation = ? AND orders = ? AND 
                      (date_from BETWEEN ? AND ? OR date_to BETWEEN ? AND ?)`;

    pool.query(checkSql, [employeeName, employeeCode, department, designation, orders, dateFromEmployee, dateToEmployee, dateFromEmployee, dateToEmployee], (err, results) => {
        if (err) {
            
            console.error('Error checking for duplicates:', err);
            return res.status(500).send({ error: 'An error occurred while checking for duplicates.' });
        }

        if (results.length > 0) {
            // Duplicate entries found
            return res.status(400).send({ error: 'A similar entry already exists in the database. Please check your input.' });
        }

        if (entries.length === 0) {
            return res.status(400).send({ error: 'No entries to insert based on the provided criteria.' });
        }

        const insertSql = 'INSERT INTO employees (name, employeeCode, department, designation, orders,quantity, date_from, date_to, user_id) VALUES ?';

        pool.query(insertSql, [entries], (err, result) => {
            if (err) {
                console.error('Error inserting entries:', err);
                return res.status(500).send({ error: 'An error occurred while creating entries.' });
            }
            res.redirect('/dashboard');
        });
    });
});

app.get("/loginPage",(req,res)=>{
    res.render("loginPage.ejs");
})
app.get("/termsandconditions",(req,res)=>{
    res.render("terms-and-conditions.ejs")
})

app.get("/item-list",(req,res)=>{
    res.render("item-list.ejs");
});

app.post("/item-list",(req,res)=>{
const {menu_item_code,type, item_description, uom, std_price, mrp} = req.body;
let q = "INSERT INTO item_list (menu_item_code,type,item_description,uom,std_price,mrp) VALUES (?,?,?,?,?,?)";
    pool.query(q, 
        [menu_item_code,type, item_description, uom, std_price, mrp], (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/view-menu-list');
    });
});

app.get("/detail-item-form",(req,res)=>{
    res.render("bom.ejs");
})

app.get("/view-today-entries",(req,res)=>{
    const today = new Date().toISOString().split('T')[0];

    const queryEmployeeEntries = `SELECT * FROM employees WHERE date_from = ?`;
    const queryGuestEntries = `SELECT * FROM guests WHERE date_from = ?`;
    
    pool.query(queryEmployeeEntries, [today], (err, employeeEntries) => {
      if (err) {
        console.error(err);
        return;
      }
    
      pool.query(queryGuestEntries, [today], (err, guestEntries) => {
        if (err) {
          console.error(err);
          return;
        }
    
        // Render the template with both employee and guest entries
        res.render('view-today-entries', {
          entries: employeeEntries,
          guestentries: guestEntries
        });
      });
    });

})

app.get("/ad-dashboard",(req,res)=>{
    res.render("ad-dashboard.ejs");
})

app.get("/view-menu-list",(req,res)=>{
    const sql = 'SELECT * FROM item_list';

    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
        // Render the view-rate-list.ejs template with rateList data
        res.render('view-menu-list.ejs', { lists: results });
    });
   
})

app.get("/edit-view-item-form/:id",(req,res)=>{
    let {id} = req.params;
    let q = `SELECT * FROM item_list WHERE id='${id}'`;
    try{
        pool.query(q,(err,result)=>{
            if(err) throw err;
            let menuListItem = result[0]
            res.render("edit-menu-item-form.ejs" ,{menuListItem});
        });
    } catch(err){
        console.log(err);
        res.send("some error in db");
    }

});

app.put("/edit-view-item-form/:id",(req,res)=>{
    let {id} = req.params;
    let{item_code : item_code , item_description : item_description, uom : uom, std_price : std_price, mrp : mrp , type : type} = req.body;
    let q = `SELECT * FROM item_list WHERE id='${id}'`;
    try{
        pool.query(q,(err,result)=>{
            if(err) throw err;
            let user = result[0]
          let q2 = `UPDATE item_list SET item_code='${item_code}',item_description='${item_description}', uom='${uom}', std_price='${std_price}', mrp='${mrp}', type='${type}'WHERE id='${id}'`;
          try{
            pool.query(q2,(err,result)=>{
                if(err) throw err;
                // let user = result[0]
                // res.render("edit-item-form.ejs" ,{user});
                res.redirect('/view-menu-list');
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

app.delete('/delete-menu-item/:id',(req,res)=>{
    let {id} = req.params;
    let q = `DELETE FROM item_list WHERE id='${id}'`;
    try{
        pool.query(q,(err,result)=>{
            if(err) throw err;
            // let user = result[0]
            res.redirect("/view-menu-list");
        });
    } catch(err){
        console.log(err);
        res.send("some error in db");
    }
})


  app.post('/fetch-item-data', (req, res) => {
    const menuItemCode = req.body.menuItemCode;
  
    const query = `SELECT item_description, uom FROM item_list WHERE menu_item_code = ?`;
    pool.query(query, [menuItemCode], (err, results) => {
      if (err) {
        console.error('Error querying MySQL:', err);
        res.status(500).json(null);
      } else if (results.length > 0) {
        res.json(results[0]);
      } else {
        res.json(null);
      }
    });
  });
// FOR REQUIREMENT FORM
app.get('/fetch-menu-item-description', (req, res) => {
    const menuItemCode = req.query.menuItemCode;
   // console.log(`Received request for menu item code: ${menuItemCode}`);
  
    const sql = `SELECT item_description FROM item_list WHERE menu_item_code = ?`;
    pool.query(sql, [menuItemCode], (error, results, fields) => {
      if (error) {
        console.error(`Error fetching menu item description: ${error}`);
        res.status(500).json({ error: 'Failed to fetch menu item description' });
      } else {
        if (results.length > 0) {
        //  console.log(`Found menu item description: ${results[0].item_description}`);
          res.json({ description: results[0].item_description });
        } else {
         // console.log(`Menu item code not found: ${menuItemCode}`);
          res.json({ description: '' });
        }
      }
    });
  });
  // Node.js backend code
app.post('/fetch-ingredient-data', (req, res) => {
    const itemCode = req.body.itemCode;
    // Query the ingredients_master table to fetch the data
    const query = `SELECT ingredient_item_description, uom,qty, rate FROM ingredients_master WHERE ingredient_item_code = ?`;
    pool.query(query, itemCode, (err, results) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch data' });
      } else {
        const data = results[0];
        if (data) {
          res.json({
            item_description: data.ingredient_item_description,
            uom: data.uom,
            rate: data.rate,
            qty:data.qty
          });
        } else {
          res.json({}); // Return an empty object if no data is found
        }
      }
    });
  });

  app.post('/menu/add', (req, res) => {
    //console.log('Received form data:', req.body); // Log the received data
  
    const { menu_item_code, item_description, uom, qty, 'itemCode[]': itemCode, 'itemDescription[]': itemDescription, 'uom[]': ingredientUOM, 'qty[]': ingredientQty, 'rate[]': rate } = req.body;
  
    // Validate received data
    if (!menu_item_code || !item_description || !uom || !qty) {
      return res.status(400).send('Required fields are missing');
    }
  
    // Insert menu item and ingredients
    const menuItemId = menu_item_code[0]; // Assuming one menu item code
    const ingredients = (itemCode || []).map((code, index) => [
      menu_item_code[0],
      item_description[0],
      uom[0],
      qty[0],
      (index + 1) * 10,
      code,
      itemDescription[index],
      ingredientUOM[index],
      ingredientQty[index],
      rate[index]
    ]);
  
    const menuAndIngredients = [
      [menu_item_code[0], item_description[0], uom[0], qty[0], 0, null, null, null, null, null], // Main menu item entry
      ...ingredients
    ];
  
    const sql = `INSERT INTO bom (menu_item_code, item_description, uom, qty, lineno, item_code, ingredient_description, ingredient_uom, ingredient_qty, rate) VALUES ?`;
  
    pool.query(sql, [menuAndIngredients], (err, result) => {
      if (err) throw err;
      res.send('New records created successfully');
    });
  });


  app.get('/menu/view', (req, res) => {
    const sql = `SELECT * FROM bom ORDER BY menu_item_code, lineno`;
  
    pool.query(sql, (err, results) => {
      if (err) throw err;
      const menuItems = {};
  
      results.forEach(row => {
        if (!menuItems[row.menu_item_code]) {
          menuItems[row.menu_item_code] = {
            details: {
              menu_item_code: row.menu_item_code,
              item_description: row.item_description,
              uom: row.uom,
              qty: row.qty
            },
            ingredients: []
          };
        }
  
        if (row.lineno !== 0) {
          menuItems[row.menu_item_code].ingredients.push({
            lineno: row.lineno,
            item_code: row.item_code,
            ingredient_description: row.ingredient_description,
            ingredient_uom: row.ingredient_uom,
            ingredient_qty: row.ingredient_qty,
            rate: row.rate
          });
        }
      });
  
      res.render('viewMenu', { menuItems });
    });
  });

  app.get('/menu/edit/:menu_item_code', (req, res) => {
    const menuItemCode = req.params.menu_item_code;
    const sql = `SELECT * FROM bom WHERE menu_item_code = ? ORDER BY lineno`;
  
    pool.query(sql, [menuItemCode], (err, results) => {
      if (err) throw err;
  
      if (results.length === 0) {
        return res.status(404).send('Menu item not found');
      }
  
      const menuItem = {
        details: {
          menu_item_code: results[0].menu_item_code,
          item_description: results[0].item_description,
          uom: results[0].uom,
          qty: results[0].qty
        },
        ingredients: results.filter(row => row.lineno !== 0)
      };
  
      res.render('editMenu', { menuItem });
    });
  });
  
  app.post('/menu/edit/:menu_item_code', (req, res) => {
    const menuItemCode = req.params.menu_item_code;
    const { item_description, uom, qty, itemCode, itemDescription, ingredient_uom, ingredient_qty, rate } = req.body;
  
    // Validate form data
    if (!item_description || !uom || !qty || !Array.isArray(itemCode) || !Array.isArray(itemDescription) || !Array.isArray(ingredient_uom) || !Array.isArray(ingredient_qty) || !Array.isArray(rate)) {
      return res.status(400).send('Invalid form data');
    }
  
    const menuItemUpdateSql = `UPDATE bom SET item_description = ?, uom = ?, qty = ? WHERE menu_item_code = ? AND lineno = 0`;
    const ingredientsDeleteSql = `DELETE FROM bom WHERE menu_item_code = ? AND lineno != 0`;
    const ingredientsInsertSql = `INSERT INTO bom (menu_item_code, item_description, uom, qty, lineno, item_code, ingredient_description, ingredient_uom, ingredient_qty, rate) VALUES ?`;
  
    // Update menu item details
    pool.query(menuItemUpdateSql, [item_description, uom, qty, menuItemCode], (err, result) => {
      if (err) throw err;
  
      // Delete old ingredients
      pool.query(ingredientsDeleteSql, [menuItemCode], (err, result) => {
        if (err) throw err;
  
        // Prepare new ingredients data
        const ingredients = itemCode.map((code, index) => [
          menuItemCode,
          item_description, // Placeholder description for ingredients
          uom,              // Placeholder unit of measure for ingredients
          qty,              // Placeholder quantity for ingredients
          (index + 1) * 10, // lineno
          code,
          itemDescription[index],
          ingredient_uom[index],
          ingredient_qty[index],
          rate[index]
        ]);
  
        // Insert new ingredients
        pool.query(ingredientsInsertSql, [ingredients], (err, result) => {
          if (err) throw err;
  
          res.redirect('/menu/view');
        });
      });
    });
  });
  
app.get("/requirement_form",(req,res)=>{
    res.render("requirement_form");
})
app.post('/submit-form', (req, res) => {
    const formData = req.body;
  
    // Insert data into MySQL
    const sql = 'INSERT INTO requirement_form (menu_item_code, menu_item_description, quantity) VALUES ?';
    const values = formData.menuItemCode.map((code, index) => [
      code,
      formData.menuItemDescription[index],
      formData.quantity[index],
    //   formData.rate[index]
    ]);
  
    pool.query(sql, [values], (err, result) => {
      if (err) {
        console.error('Error inserting data: ' + err.stack);
        res.status(500).send('Error inserting data into database');
        return;
      }
      //console.log('Inserted ' + result.affectedRows + ' rows'); 
      
      res.redirect('/requirement_form');
    });
  });

  app.post('/calculate-requirements', (req, res) => {
    const { 'menuItemCode[]': menuItemCode, 'quantity[]': quantity } = req.body;
  
    if (!menuItemCode || !quantity) {
      return res.status(400).send('Invalid input data');
    }
  
    let results = [];
    let pendingQueries = menuItemCode.length;
  
    menuItemCode.forEach((menuItem, index) => {
      const reqQty = parseFloat(quantity[index]);
  
      // Log the quantity to check if it's parsed correctly
     // console.log(`Parsed Quantity for ${menuItem}: ${reqQty}`);
  
      // Check if the parsed quantity is a valid number
      if (isNaN(reqQty)) {
        console.error(`Invalid quantity value for ${menuItem}: ${quantity[index]}`);
        return res.status(400).send('Invalid quantity value');
      }
  
      const query = `
        SELECT 
          b.menu_item_code,
          b.item_code,
          b.ingredient_description,
          b.ingredient_uom,
          CAST(b.ingredient_qty AS DECIMAL(10,2)) AS ingredient_qty,
          CAST(b.rate AS DECIMAL(10,2)) AS rate,
          CAST(b.ingredient_qty * ? AS DECIMAL(10,2)) AS total_ingredient_qty,
          CAST(b.rate * ? AS DECIMAL(10,2)) AS total_cost
        FROM bom b
        WHERE b.menu_item_code = ?
      `;
  
      // Log the query and values for debugging
     // console.log('Executing query:', query);
    //  console.log('With values:', [reqQty, reqQty, menuItem]);
  
      pool.query(query, [reqQty, reqQty, menuItem], (error, result) => {
        if (error) {
         // console.error('Query Error:', error);
          return res.status(500).send('Server Error');
        }
  
        // Log the result of the query
        //console.log('Query Result:', result);
  
        result.forEach(row => {
          // Log intermediate values
        //  console.log(`Multiplying ${row.ingredient_qty} by ${reqQty} gives ${row.total_ingredient_qty}`);
         // console.log(`Multiplying ${row.rate} by ${reqQty} gives ${row.total_cost}`);
  
          // Skip rows with null values for required fields
          if (row.item_code === null || row.ingredient_description === null || row.ingredient_uom === null) {
           // console.log('Skipping row with null values:', row);
            return;
          }
  
          results.push(row);
  
          // Insert results into requirement_ingredients table
          const insertQuery = `
            INSERT INTO requirement_ingredients 
            (menu_item_code, item_code, ingredient_description, ingredient_uom, ingredient_qty, rate, total_ingredient_qty, total_cost) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;
          const values = [
            row.menu_item_code,
            row.item_code,
            row.ingredient_description,
            row.ingredient_uom,
            row.ingredient_qty,
            row.rate,
            row.total_ingredient_qty,
            row.total_cost
          ];
  
          // Log the values to be inserted
       //   console.log('Inserting values:', values);
  
          pool.query(insertQuery, values, (insertError) => {
            if (insertError) {
              console.error('Insert Error:', insertError);
            }
          });
        });
  
        pendingQueries--;
        if (pendingQueries === 0) {
          //console.log('Final Results:', results);
          res.json(results);
        }
      });
    });
  });
  

  app.get("/ingredients_master",(req,res)=>{
    res.render("ingredients_master.ejs");
  })
  
app.post("/ingredients_master",(req,res)=>{
    const {ingredient_item_code,ingredient_item_description,uom,ingredient_item_type,opening_balance_quantity} = req.body;
    let q = "INSERT INTO ingredients_master (ingredient_item_code,ingredient_item_description,uom,ingredient_item_type,opening_balance_quantity) VALUES (?,?,?,?,?)";
    pool.query(q, 
        [ingredient_item_code,ingredient_item_description,uom,ingredient_item_type,opening_balance_quantity], (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/ingredients_master');
    });
    
})

app.get("/view_ingredients_master",(req,res)=>{
    let q = "SELECT * FROM ingredients_master";
    pool.query(q, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
       
        res.render('view_ingredients_master.ejs', { ingredients: results });
    });
})



app.put("/edit_view_ingredients_master/:id",(req,res)=>{
    let {id} = req.params;
    let{ingredient_item_code : ingredient_item_code , ingredient_item_description : ingredient_item_description, uom : uom} = req.body;
    let q = `SELECT * FROM ingredients_master WHERE id='${id}'`;
    try{
        pool.query(q,(err,result)=>{
            if(err) throw err;
            let ingredient = result[0]
          let q2 = `UPDATE ingredients_master SET ingredient_item_code='${ingredient_item_code}',ingredient_item_description='${ingredient_item_description}', uom='${uom}'WHERE id='${id}'`;
          try{
            pool.query(q2,(err,result)=>{
                if(err) throw err;
                
                res.redirect('/view_ingredients_master');
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

app.delete('/delete_view_ingredients_master/:id',(req,res)=>{
    let {id} = req.params;
    let q = `DELETE FROM ingredients_master WHERE id='${id}'`;
    try{
        pool.query(q,(err,result)=>{
            if(err) throw err;
            // let user = result[0]
            res.redirect("/view_ingredients_master");
        });
    } catch(err){
        console.log(err);
        res.send("some error in db");
    }
})

app.get("/ingredient_inward_form",(req,res)=>{
    res.render('ingredient_inward_form.ejs');
})
app.post('/ingredient_inward_form', (req, res) => {
    const {
      bill_number,
      supplier_code,
      supplier_name,
      material_received_by,
      bill_date,
      ingredient_item_code,
      ingredient_item_description,
      received_quantity,
      rate,
      amount,
      total_cost
    } = req.body;

    // Create SQL query for inserting ingredient details
    const sql = `
      INSERT INTO ingredients_inward (
        bill_number,
        supplier_code,
        supplier_name,
        material_received_by,
        bill_date,
        ingredient_item_code,
        ingredient_item_description,
        received_quantity,
        rate,
        amount,
        total_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Use a promise to handle the completion of all insert operations
    const insertPromises = [];

    for (let i = 0; i < ingredient_item_code.length; i++) {
        insertPromises.push(new Promise((resolve, reject) => {
            pool.query(sql, [
              bill_number,
              supplier_code,
              supplier_name,
              material_received_by,
              bill_date,
              ingredient_item_code[i],
              ingredient_item_description[i],
              received_quantity[i],
              rate[i],
              amount[i],
              total_cost
            ], (err, result) => {
                if (err) {
                    console.error('Error inserting data: ', err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        }));
    }

    Promise.all(insertPromises)
        .then(() => res.redirect("/ingredient_inward_form"))
        .catch(err => {
            console.error('Error processing rows: ', err);
            res.status(500).send('Error processing rows');
        });
});

    app.post('/get-ingredient-description', (req, res) => {
        const { ingredient_item_code } = req.body;
        const sql = 'SELECT ingredient_item_description FROM ingredients_master WHERE ingredient_item_code = ?';
        pool.query(sql, [ingredient_item_code], (err, result) => {
            if (err) throw err;
            if (result.length > 0) {
                res.json({ description: result[0].ingredient_item_description });
            } else {
                res.json({ description: '' });
            }
        });
    });

    app.get("/ingredient_outward",(req,res)=>{
        res.render("ingredient_outward.ejs");
    })

    app.post('/ingredient_outward', (req, res) => {
        const { issued_to, issue_date, ingredient_item_code, ingredient_item_description, issued_quantity } = req.body;
    
        // Prepare an array of values for batch insertion
        const values = ingredient_item_code.map((code, index) => [
            issued_to,
            issue_date,
            code,
            ingredient_item_description[index],
            issued_quantity[index]
        ]);
    
        // SQL query to insert data
        const sql = `
            INSERT INTO ingredient_outward (issued_to, issue_date, ingredient_item_code, ingredient_item_description, issued_quantity)
            VALUES ?
        `;
    
        // Execute the query with batch data insertion
        pool.query(sql, [values], (err, result) => {
            if (err) {
                console.error('Error inserting data:', err);
                return res.status(500).send('Error inserting data');
            }
            //console.log('Data inserted successfully');
            res.redirect('/ingredient_outward'); // Redirect to a success page or dashboard
        });
    });


   app.get('/view_stock', (req, res) => {
    const query = `
        SELECT 
            im.ingredient_item_code, 
            im.ingredient_item_description,
            im.opening_balance_quantity,
            IFNULL(rq.total_received_quantity, 0) AS received_quantity,
            IFNULL(iq.total_issued_quantity, 0) AS issued_quantity,
            (im.opening_balance_quantity + IFNULL(rq.total_received_quantity, 0) - IFNULL(iq.total_issued_quantity, 0)) AS current_stock
        FROM ingredients_master im
        LEFT JOIN (
            SELECT 
                ingredient_item_code, 
                SUM(received_quantity) AS total_received_quantity
            FROM ingredients_inward
            GROUP BY ingredient_item_code
        ) rq ON im.ingredient_item_code = rq.ingredient_item_code
        LEFT JOIN (
            SELECT 
                ingredient_item_code, 
                SUM(issued_quantity) AS total_issued_quantity
            FROM ingredient_outward
            GROUP BY ingredient_item_code
        ) iq ON im.ingredient_item_code = iq.ingredient_item_code
    `;

    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error executing query:', error);
            res.status(500).send('Internal Server Error');
            return;
        }
        const ingredients = results; // Assign query results to ingredients variable
        res.render('view_stock', { ingredients }); // Ensure the template name matches your actual file name
    });
});

app.get("/debit_invoice",(req,res)=>{
    res.render("debit_invoice.ejs");
})


app.post("/debit_invoice",(req,res)=>{
    const {bill_number,supplier_code,supplier_name,bill_date,debit_bill_amount} = req.body;
    let q = "INSERT INTO debit_bill (bill_number,supplier_code,supplier_name,bill_date,debit_bill_amount) VALUES (?,?,?,?,?)";
    pool.query(q, 
        [bill_number,supplier_code,supplier_name,bill_date,debit_bill_amount], (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/debit_invoice');
    });
    
})

app.get("/credit_invoice",(req,res)=>{
    res.render("credit_invoice.ejs");
})

app.post("/credit_invoice",(req,res)=>{
    const {bill_number,supplier_code,supplier_name,bill_date,credit_bill_amount} = req.body;
    let q = "INSERT INTO credit_bill (bill_number,supplier_code,supplier_name,bill_date,credit_bill_amount) VALUES (?,?,?,?,?)";
    pool.query(q, 
        [bill_number,supplier_code,supplier_name,bill_date,credit_bill_amount], (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/credit_invoice');
    });
    
})

app.get("/suppliers_master",(req,res)=>{
    res.render("suppliers_master.ejs");
})

app.post("/suppliers_master",(req,res)=>{
    const {supplier_code,supplier_name,gst_no,pan_no,mobile_no,address,city} = req.body;
    let q = "INSERT INTO supplier_master (supplier_code,supplier_name,gst_no,pan_no,mobile_no,address,city) VALUES (?,?,?,?,?,?,?)";
    pool.query(q, 
        [supplier_code,supplier_name,gst_no,pan_no,mobile_no,address,city], (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/suppliers_master');
    });
    
})


app.get('/get-item-codes', (req, res) => {
    const query = 'SELECT ingredient_item_code, ingredient_item_description FROM ingredients_master';
    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching item codes:', error);
            res.status(500).send('Server error');
        } else {
            res.json(results);
        }
    });
});

app.get('/get-supplier-codes', (req, res) => {
    const query = 'SELECT supplier_code,supplier_name FROM supplier_master';
    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching item codes:', error);
            res.status(500).send('Server error');
        } else {
            res.json(results);
        }
    });
});

app.post('/get-supplier-name', (req, res) => {
    const { supplier_code } = req.body;
    const sql = 'SELECT supplier_name FROM supplier_master WHERE supplier_code = ?';
    pool.query(sql, [supplier_code], (err, result) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (result.length > 0) {
            res.json({ supplier_name: result[0].supplier_name });
        } else {
            res.json({ supplier_name: '' });
        }
    });
});

// app.get("/outstanding_invoice",(req,res)=>{
//     res.render("outstanding_invoice.ejs");
// })

app.get('/outstanding_invoice', (req, res) => {
    const supplierQuery = `
        SELECT sm.supplier_code, sm.supplier_name,
            COALESCE(credit.total_credit, 0) AS total_credit,
            COALESCE(debit.total_debit, 0) AS total_debit
        FROM supplier_master sm
        LEFT JOIN (
            SELECT supplier_code, SUM(credit_bill_amount) AS total_credit
            FROM credit_bill
            GROUP BY supplier_code
        ) AS credit ON sm.supplier_code = credit.supplier_code
        LEFT JOIN (
            SELECT supplier_code, SUM(debit_bill_amount) AS total_debit
            FROM debit_bill
            GROUP BY supplier_code
        ) AS debit ON sm.supplier_code = debit.supplier_code
    `;

    pool.query(supplierQuery, (err, results) => {
        if (err) throw err;
        //console.log(results);  // Log the raw results

        const suppliers = results.map(supplier => ({
            ...supplier,
            total_credit: parseFloat(supplier.total_credit) || 0,
            total_debit: parseFloat(supplier.total_debit) || 0,
            outstanding_amount: (parseFloat(supplier.total_debit) || 0) - (parseFloat(supplier.total_credit) || 0)
        }));

        //console.log(suppliers);  // Log the suppliers data to debug
        res.render('outstanding_invoice', { suppliers });
    });
});

app.get("/view_credit_invoice",(req,res)=>{
    let q = "SELECT * FROM credit_bill";
    pool.query(q, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
       
        res.render('view_credit_invoice.ejs', { credits: results });
    });
    
})

app.get("/edit_credit_bill/:id",(req,res)=>{
    let { id } = req.params;
    let q = `SELECT * FROM credit_bill WHERE id='${id}'`;
    pool.query(q, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
       
        res.render('edit_credit_bill.ejs', { credit: results[0] });
    });
})

app.put("/edit_credit_bill/:id", (req, res) => {
    let { id } = req.params;
    let { supplier_code, supplier_name, bill_number, bill_date, credit_bill_amount } = req.body;

    let q = `SELECT * FROM credit_bill WHERE id = ?`;
    pool.query(q, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.send("Some error in db");
        }

        if (result.length === 0) {
            return res.send("No record found with the given id");
        }

        let q2 = `UPDATE credit_bill SET supplier_code = ?, supplier_name = ?, bill_number = ?, bill_date = ?, credit_bill_amount = ? WHERE id = ?`;
        pool.query(q2, [supplier_code, supplier_name, bill_number, bill_date, credit_bill_amount, id], (err, result) => {
            if (err) {
                console.error(err);
                return res.send("Some error in db");
            }

            res.redirect('/view_credit_invoice');
        });
    });
});

app.get("/view_debit_invoice",(req,res)=>{
    let q = "SELECT * FROM debit_bill";
    pool.query(q, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
       
        res.render('view_debit_invoice.ejs', { debits: results });
    });
    
})

app.get("/edit_debit_bill/:id",(req,res)=>{
    let { id } = req.params;
    let q = `SELECT * FROM debit_bill WHERE id='${id}'`;
    pool.query(q, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
       
        res.render('edit_debit_bill.ejs', { debit: results[0] });
    });
})


app.put("/edit_debit_bill/:id", (req, res) => {
    let { id } = req.params;
    let { supplier_code, supplier_name, bill_number, bill_date, debit_bill_amount } = req.body;

    let q = `SELECT * FROM debit_bill WHERE id = ?`;
    pool.query(q, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.send("Some error in db");
        }

        if (result.length === 0) {
            return res.send("No record found with the given id");
        }

        let q2 = `UPDATE debit_bill SET supplier_code = ?, supplier_name = ?, bill_number = ?, bill_date = ?, debit_bill_amount = ? WHERE id = ?`;
        pool.query(q2, [supplier_code, supplier_name, bill_number, bill_date, debit_bill_amount, id], (err, result) => {
            if (err) {
                console.error(err);
                return res.send("Some error in db");
            }

            res.redirect('/view_debit_invoice');
        });
    });
});
app.post('/get-total-cost', (req, res) => {
    const { bill_number } = req.body;

    const query = 'SELECT total_cost FROM ingredients_inward WHERE bill_number = ?';
    pool.query(query, [bill_number], (err, results) => {
        if (err) {
            console.error('Error fetching total cost:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length > 0) {
            res.json({ total_cost: results[0].total_cost });
        } else {
            res.status(404).json({ error: 'Bill number not found' });
        }
    });
});


app.get("/view_ingredient_inward",(req,res)=>{
    let q = `SELECT * FROM ingredients_inward`
    pool.query(q, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
       
        res.render('view_ingredient_inward.ejs', { inwardIngredients: results });
    });
    
})

app.get("/view_ingredient_outward",(req,res)=>{
    let q = `SELECT * FROM ingredient_outward`
    pool.query(q, (err, results) => {
        if (err) {
            console.error('Error retrieving data from database:', err);
            return res.status(500).send('Internal Server Error');
        }
       
        res.render('view_ingredient_outward.ejs', { outwardIngredients: results });
    });
    
})

app.get("/test",(req,res)=>{
    res.render('test.ejs');
})
// Start server
const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

