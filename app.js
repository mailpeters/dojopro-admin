const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const flash = require('express-flash');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3002;

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'dojoapp',
    password: 'djppass',
    database: 'dojopro'
});

// Test database connection
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to MariaDB database');
    }
});

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: 'dojopro-admin-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(flash());

// Global middleware to pass user session to all templates
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.messages = req.flash();
    next();
});

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        req.flash('error', 'Please log in to access this page');
        res.redirect('/login');
    }
};

// Middleware to check if user owns the club
const requireClubAccess = async (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        // Get user's club access
        const clubAccess = await new Promise((resolve, reject) => {
            db.query(`
                SELECT cs.club_id, cs.role, c.club_name
                FROM club_staff cs 
                JOIN clubs c ON cs.club_id = c.club_id
                WHERE cs.user_id = ? AND c.status = 'active'
            `, [req.session.user.user_id], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        if (clubAccess.length === 0) {
            req.flash('error', 'You do not have access to any clubs');
            return res.redirect('/setup');
        }

        // For now, use the first club (later we can add club switching)
        req.userClub = clubAccess[0];
        res.locals.userClub = clubAccess[0];
        next();

    } catch (error) {
        console.error('Error checking club access:', error);
        req.flash('error', 'Error accessing club information');
        res.redirect('/login');
    }
};

// Routes

// Home page - redirect to dashboard if authenticated
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// Login page
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/login', {
        title: 'Login - DojoPro Admin'
    });
});

// Login POST
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            req.flash('error', 'Please provide email and password');
            return res.redirect('/login');
        }

        // Find user
        const user = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [email], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });

        if (!user) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }

        // Check if password is still temporary
        if (user.password_hash === 'TEMP_HASH_TO_BE_SET') {
            req.flash('info', 'Please set up your password');
            return res.redirect(`/setup-password?email=${encodeURIComponent(email)}`);
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }

        // Set session
        req.session.user = {
            user_id: user.user_id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
        };

        req.flash('success', `Welcome back, ${user.first_name}!`);
        res.redirect('/dashboard');

    } catch (error) {
        console.error('Login error:', error);
        req.flash('error', 'An error occurred during login');
        res.redirect('/login');
    }
});

// Password setup page
app.get('/setup-password', (req, res) => {
    const email = req.query.email;
    if (!email) {
        req.flash('error', 'Invalid setup link');
        return res.redirect('/login');
    }

    res.render('auth/setup-password', {
        title: 'Set Up Password - DojoPro Admin',
        email: email
    });
});

// Password setup POST
app.post('/setup-password', async (req, res) => {
    try {
        const { email, password, confirm_password } = req.body;

        if (!email || !password || !confirm_password) {
            req.flash('error', 'All fields are required');
            return res.redirect(`/setup-password?email=${encodeURIComponent(email)}`);
        }

        if (password !== confirm_password) {
            req.flash('error', 'Passwords do not match');
            return res.redirect(`/setup-password?email=${encodeURIComponent(email)}`);
        }

        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters long');
            return res.redirect(`/setup-password?email=${encodeURIComponent(email)}`);
        }

        // Find user with temporary password
        const user = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE email = ? AND password_hash = "TEMP_HASH_TO_BE_SET"', [email], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });

        if (!user) {
            req.flash('error', 'Invalid setup request');
            return res.redirect('/login');
        }

        // Hash password and update
        const hashedPassword = await bcrypt.hash(password, 12);
        
        await new Promise((resolve, reject) => {
            db.query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?', 
                [hashedPassword, user.user_id], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        req.flash('success', 'Password set successfully! Please log in.');
        res.redirect('/login');

    } catch (error) {
        console.error('Password setup error:', error);
        req.flash('error', 'An error occurred setting up your password');
        res.redirect(`/setup-password?email=${encodeURIComponent(req.body.email || '')}`);
    }
});

// Dashboard
app.get('/dashboard', requireAuth, requireClubAccess, async (req, res) => {
    try {
        // Get club statistics
        const stats = await new Promise((resolve, reject) => {
            db.query(`
                SELECT 
                    (SELECT COUNT(*) FROM members WHERE club_id = ? AND status = 'active') as active_members,
                    (SELECT COUNT(*) FROM members WHERE club_id = ? AND status = 'pending') as pending_members,
                    (SELECT COUNT(*) FROM locations WHERE club_id = ?) as total_locations,
                    (SELECT COUNT(*) FROM club_staff WHERE club_id = ?) as total_staff
            `, [req.userClub.club_id, req.userClub.club_id, req.userClub.club_id, req.userClub.club_id], 
            (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });

        // Get recent member activity
        const recentMembers = await new Promise((resolve, reject) => {
            db.query(`
                SELECT first_name, last_name, email, status, created_at
                FROM members 
                WHERE club_id = ? 
                ORDER BY created_at DESC 
                LIMIT 5
            `, [req.userClub.club_id], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        res.render('dashboard/index', {
            title: 'Dashboard - DojoPro Admin',
            stats,
            recentMembers
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/login');
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'admin-portal',
        database: db.state === 'authenticated' ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Admin portal running on http://3.227.191.44:${PORT}`);
});

// Club Settings Routes
app.get('/club', requireAuth, requireClubAccess, async (req, res) => {
    try {
        // Get club details
        const clubDetails = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM clubs WHERE club_id = ?', [req.userClub.club_id], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });

        res.render('club/settings', {
            title: 'Club Settings - DojoPro Admin',
            club: clubDetails
        });

    } catch (error) {
        console.error('Club settings error:', error);
        req.flash('error', 'Error loading club settings');
        res.redirect('/dashboard');
    }
});

// Update club settings
app.post('/club/update', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const { club_name, description, website_url } = req.body;

        if (!club_name) {
            req.flash('error', 'Club name is required');
            return res.redirect('/club');
        }

        await new Promise((resolve, reject) => {
            db.query(`
                UPDATE clubs 
                SET club_name = ?, description = ?, website_url = ?, updated_at = NOW()
                WHERE club_id = ?
            `, [club_name, description || null, website_url || null, req.userClub.club_id], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        req.flash('success', 'Club settings updated successfully!');
        res.redirect('/club');

    } catch (error) {
        console.error('Club update error:', error);
        req.flash('error', 'Error updating club settings');
        res.redirect('/club');
    }
});

// Members Management Routes
app.get('/members', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const members = await new Promise((resolve, reject) => {
            db.query(`
                SELECT m.*, h.household_name
                FROM members m
                LEFT JOIN households h ON m.household_id = h.household_id
                WHERE m.club_id = ? AND m.deleted_at IS NULL
                ORDER BY m.created_at DESC
            `, [req.userClub.club_id], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        res.render('members/index', {
            title: 'Members - DojoPro Admin',
            members
        });

    } catch (error) {
        console.error('Members list error:', error);
        req.flash('error', 'Error loading members');
        res.redirect('/dashboard');
    }
});

// Add member form
app.get('/members/add', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const households = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM households WHERE club_id = ? ORDER BY household_name', 
                [req.userClub.club_id], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        res.render('members/add', {
            title: 'Add Member - DojoPro Admin',
            households
        });

    } catch (error) {
        console.error('Add member form error:', error);
        req.flash('error', 'Error loading add member form');
        res.redirect('/members');
    }
});

// Create member
app.post('/members/create', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const {
            first_name, last_name, email, phone, date_of_birth,
            membership_type, household_id, belt_rank,
            emergency_contact_name, emergency_contact_phone
        } = req.body;

        if (!first_name || !last_name) {
            req.flash('error', 'First name and last name are required');
            return res.redirect('/members/add');
        }

        // Check if email already exists for this club
        if (email) {
            const existingMember = await new Promise((resolve, reject) => {
                db.query('SELECT member_id FROM members WHERE club_id = ? AND email = ? AND deleted_at IS NULL', 
                    [req.userClub.club_id, email], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });

            if (existingMember.length > 0) {
                req.flash('error', 'A member with this email already exists');
                return res.redirect('/members/add');
            }
        }

        let finalHouseholdId = household_id;

        // Create new household if needed
        if (membership_type === 'family' && !household_id) {
            const householdResult = await new Promise((resolve, reject) => {
                db.query(`
                    INSERT INTO households (club_id, household_name, created_at, updated_at)
                    VALUES (?, ?, NOW(), NOW())
                `, [req.userClub.club_id, `${first_name} ${last_name} Family`], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
            finalHouseholdId = householdResult.insertId;
        }

        // Create member
        await new Promise((resolve, reject) => {
            db.query(`
                INSERT INTO members (
                    club_id, household_id, membership_type, membership_start_date,
                    status, belt_rank, emergency_contact_name, emergency_contact_phone,
                    date_of_birth, first_name, last_name, email, phone,
                    is_primary_member, created_at, updated_at
                ) VALUES (?, ?, ?, CURDATE(), 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                req.userClub.club_id, finalHouseholdId, membership_type || 'individual',
                belt_rank || null, emergency_contact_name || null, emergency_contact_phone || null,
                date_of_birth || null, first_name, last_name, email || null, phone || null,
                membership_type === 'family' && !household_id ? 1 : 0
            ], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        req.flash('success', `Member ${first_name} ${last_name} added successfully!`);
        res.redirect('/members');

    } catch (error) {
        console.error('Create member error:', error);
        req.flash('error', 'Error creating member');
        res.redirect('/members/add');
    }
});

// Locations Management
app.get('/locations', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const locations = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM locations WHERE club_id = ? ORDER BY is_primary_location DESC, location_name', 
                [req.userClub.club_id], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        res.render('locations/index', {
            title: 'Locations - DojoPro Admin',
            locations
        });

    } catch (error) {
        console.error('Locations error:', error);
        req.flash('error', 'Error loading locations');
        res.redirect('/dashboard');
    }
});
