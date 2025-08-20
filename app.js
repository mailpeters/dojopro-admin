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
// Settings route (redirect to club settings)
//app.get('/settings', requireAuth, requireClubAccess, (req, res) => {
//    res.redirect('/club');
//});


// GET /settings - Club settings page
app.get('/settings', requireAuth, requireClubAccess, async (req, res) => {
    try {
        // Get club details
        const clubDetails = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM clubs WHERE club_id = ?', [req.userClub.club_id], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });

        // Get club settings
        const clubSettings = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM club_settings WHERE club_id = ?', [req.userClub.club_id], (err, results) => {
                if (err) reject(err);
                else resolve(results[0] || {});
            });
        });

        res.render('club/settings', {
            title: 'Club Settings',
            clubDetails,
            clubSettings,
            messages: req.flash()
        });
    } catch (error) {
        console.error('Settings error:', error);
        req.flash('error', 'Error loading settings');
        res.redirect('/dashboard');
    }
});

// POST /settings - Update club settings
app.post('/settings', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const {
            club_name,
            description,
            website_url,
            logo_url,
            primary_color,
            secondary_color,
            locale,
            timezone
        } = req.body;

        const clubId = req.userClub.club_id;

        // Update club details
        await new Promise((resolve, reject) => {
            db.query(
                'UPDATE clubs SET club_name = ?, description = ?, website_url = ?, logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE club_id = ?',
                [club_name, description, website_url || null, logo_url || null, clubId],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });

        // Update or insert club settings
        await new Promise((resolve, reject) => {
            db.query(
                `INSERT INTO club_settings (club_id, logo_url, primary_color, secondary_color, locale, timezone, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON DUPLICATE KEY UPDATE
                 logo_url = VALUES(logo_url),
                 primary_color = VALUES(primary_color),
                 secondary_color = VALUES(secondary_color),
                 locale = VALUES(locale),
                 timezone = VALUES(timezone),
                 updated_at = CURRENT_TIMESTAMP`,
                [clubId, logo_url || null, primary_color || null, secondary_color || null, locale || 'en-US', timezone || 'America/New_York'],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });

        req.flash('success', 'Club settings updated successfully');
        res.redirect('/settings');
    } catch (error) {
        console.error('Error updating settings:', error);
        req.flash('error', 'Error updating settings');
        res.redirect('/settings');
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


// GET /locations/add - Show add location form
app.get('/locations/add', requireAuth, requireClubAccess, (req, res) => {
    res.render('locations/add', {
        title: 'Add New Location',
        messages: req.flash(),
        formData: {}
    });
});

// POST /locations/add - Create new location
app.post('/locations/add', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const {
            location_name,
            address_line1,
            address_line2,
            city,
            state,
            postal_code,
            phone,
            capacity,
            timezone,
            is_primary_location
        } = req.body;

        const clubId = req.userClub.club_id;

        // If this is being set as primary, unset any existing primary location
        if (is_primary_location) {
            await new Promise((resolve, reject) => {
                db.query('UPDATE locations SET is_primary_location = 0 WHERE club_id = ?',
                    [clubId], (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
            });
        }

        await new Promise((resolve, reject) => {
            db.query(
                `INSERT INTO locations (
                    club_id, location_name, address_line1, address_line2, 
                    city, state, postal_code, phone, capacity, timezone, is_primary_location
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    clubId, location_name, address_line1, address_line2 || null,
                    city, state, postal_code, phone || null, capacity || null,
                    timezone || 'America/New_York', is_primary_location ? 1 : 0
                ],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });

        req.flash('success', 'Location added successfully');
        res.redirect('/locations');
    } catch (error) {
        console.error('Error adding location:', error);
        req.flash('error', 'Error adding location');
        res.render('locations/add', {
            title: 'Add New Location',
            messages: req.flash(),
            formData: req.body
        });
    }
});

// GET /locations/:id/edit - Show edit location form
app.get('/locations/:id/edit', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const clubId = req.userClub.club_id;
        const locationId = req.params.id;

        const location = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM locations WHERE location_id = ? AND club_id = ?',
                [locationId, clubId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results[0]);
                });
        });

        if (!location) {
            req.flash('error', 'Location not found');
            return res.redirect('/locations');
        }

        res.render('locations/edit', {
            title: 'Edit Location',
            location: location,
            messages: req.flash()
        });
    } catch (error) {
        console.error('Error fetching location:', error);
        req.flash('error', 'Error loading location');
        res.redirect('/locations');
    }
});

// POST /locations/:id/edit - Update location
app.post('/locations/:id/edit', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const {
            location_name,
            address_line1,
            address_line2,
            city,
            state,
            postal_code,
            phone,
            capacity,
            timezone,
            is_primary_location
        } = req.body;

        const clubId = req.userClub.club_id;
        const locationId = req.params.id;

        // If this is being set as primary, unset any existing primary location
        if (is_primary_location) {
            await new Promise((resolve, reject) => {
                db.query('UPDATE locations SET is_primary_location = 0 WHERE club_id = ? AND location_id != ?',
                    [clubId, locationId], (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
            });
        }

        await new Promise((resolve, reject) => {
            db.query(
                `UPDATE locations SET 
                    location_name = ?, address_line1 = ?, address_line2 = ?,
                    city = ?, state = ?, postal_code = ?, phone = ?, capacity = ?,
                    timezone = ?, is_primary_location = ?, updated_at = CURRENT_TIMESTAMP
                WHERE location_id = ? AND club_id = ?`,
                [
                    location_name, address_line1, address_line2 || null,
                    city, state, postal_code, phone || null, capacity || null,
                    timezone || 'America/New_York', is_primary_location ? 1 : 0,
                    locationId, clubId
                ],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });

        req.flash('success', 'Location updated successfully');
        res.redirect('/locations');
    } catch (error) {
        console.error('Error updating location:', error);
        req.flash('error', 'Error updating location');
        res.redirect(`/locations/${req.params.id}/edit`);
    }
});

// POST /locations/:id/delete - Delete location
app.post('/locations/:id/delete', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const clubId = req.userClub.club_id;
        const locationId = req.params.id;

        // Check if this is the primary location
        const location = await new Promise((resolve, reject) => {
            db.query('SELECT is_primary_location FROM locations WHERE location_id = ? AND club_id = ?',
                [locationId, clubId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results[0]);
                });
        });

        if (!location) {
            req.flash('error', 'Location not found');
            return res.redirect('/locations');
        }

        if (location.is_primary_location) {
            req.flash('error', 'Cannot delete the primary location');
            return res.redirect('/locations');
        }

        await new Promise((resolve, reject) => {
            db.query('DELETE FROM locations WHERE location_id = ? AND club_id = ?',
                [locationId, clubId], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
        });

        req.flash('success', 'Location deleted successfully');
        res.redirect('/locations');
    } catch (error) {
        console.error('Error deleting location:', error);
        req.flash('error', 'Error deleting location');
        res.redirect('/locations');
    }
});


// GET /staff - List all staff
app.get('/staff', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const staff = await new Promise((resolve, reject) => {
            db.query(`
                SELECT cs.*, u.first_name, u.last_name, u.email, u.phone 
                FROM club_staff cs 
                JOIN users u ON cs.user_id = u.user_id 
                WHERE cs.club_id = ? 
                ORDER BY cs.role, u.last_name, u.first_name
            `, [req.userClub.club_id], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
        
        res.render('staff/index', {
            title: 'Staff Management',
            staff
        });
    } catch (error) {
        console.error('Staff error:', error);
        req.flash('error', 'Error loading staff');
        res.redirect('/dashboard');
    }
});

// GET /staff/add - Show add staff form
app.get('/staff/add', requireAuth, requireClubAccess, (req, res) => {
    res.render('staff/add', {
        title: 'Add New Staff',
        messages: req.flash(),
        formData: {}
    });
});

// POST /staff/add - Create new staff
app.post('/staff/add', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const { email, first_name, last_name, phone, role, is_primary_contact } = req.body;
        const clubId = req.userClub.club_id;

        // Check if user already exists
        let user = await new Promise((resolve, reject) => {
            db.query('SELECT user_id FROM users WHERE email = ?', [email], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });

        let userId;
        if (user) {
            userId = user.user_id;
        } else {
            // Create new user with temporary password
            const tempPassword = Math.random().toString(36).slice(-8);
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            
            const result = await new Promise((resolve, reject) => {
                db.query(
                    'INSERT INTO users (email, password_hash, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?)',
                    [email, hashedPassword, first_name, last_name, phone],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
            userId = result.insertId;
        }

        // Add to club staff
        await new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO club_staff (club_id, user_id, role, is_primary_contact) VALUES (?, ?, ?, ?)',
                [clubId, userId, role, is_primary_contact ? 1 : 0],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });

        req.flash('success', 'Staff member added successfully');
        res.redirect('/staff');
    } catch (error) {
        console.error('Error adding staff:', error);
        req.flash('error', 'Error adding staff member');
        res.render('staff/add', {
            title: 'Add New Staff',
            messages: req.flash(),
            formData: req.body
        });
    }
});

// GET /staff/:id/edit - Show edit staff form
app.get('/staff/:id/edit', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const clubId = req.userClub.club_id;
        const userId = req.params.id;

        const staff = await new Promise((resolve, reject) => {
            db.query(`
                SELECT cs.*, u.first_name, u.last_name, u.email, u.phone 
                FROM club_staff cs 
                JOIN users u ON cs.user_id = u.user_id 
                WHERE cs.user_id = ? AND cs.club_id = ?
            `, [userId, clubId], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });

        if (!staff) {
            req.flash('error', 'Staff member not found');
            return res.redirect('/staff');
        }

        res.render('staff/edit', {
            title: 'Edit Staff Member',
            staff: staff,
            messages: req.flash()
        });
    } catch (error) {
        console.error('Error fetching staff:', error);
        req.flash('error', 'Error loading staff member');
        res.redirect('/staff');
    }
});

// POST /staff/:id/edit - Update staff
app.post('/staff/:id/edit', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const { first_name, last_name, phone, role, is_primary_contact } = req.body;
        const clubId = req.userClub.club_id;
        const userId = req.params.id;

        // Update user info
        await new Promise((resolve, reject) => {
            db.query(
                'UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE user_id = ?',
                [first_name, last_name, phone, userId],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });

        // Update club staff info
        await new Promise((resolve, reject) => {
            db.query(
                'UPDATE club_staff SET role = ?, is_primary_contact = ? WHERE user_id = ? AND club_id = ?',
                [role, is_primary_contact ? 1 : 0, userId, clubId],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });

        req.flash('success', 'Staff member updated successfully');
        res.redirect('/staff');
    } catch (error) {
        console.error('Error updating staff:', error);
        req.flash('error', 'Error updating staff member');
        res.redirect(`/staff/${req.params.id}/edit`);
    }
});

// POST /staff/:id/delete - Delete staff
app.post('/staff/:id/delete', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const clubId = req.userClub.club_id;
        const userId = req.params.id;

        await new Promise((resolve, reject) => {
            db.query(
                'DELETE FROM club_staff WHERE user_id = ? AND club_id = ?',
                [userId, clubId],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });

        req.flash('success', 'Staff member removed successfully');
        res.redirect('/staff');
    } catch (error) {
        console.error('Error deleting staff:', error);
        req.flash('error', 'Error removing staff member');
        res.redirect('/staff');
    }
});


// GET /check-ins - List all check-ins
app.get('/checkins', requireAuth, requireClubAccess, async (req, res) => {
    try {
        const checkins = await new Promise((resolve, reject) => {
            db.query(`
                SELECT ci.*, 
                       m.first_name, m.last_name, m.email,
                       l.location_name,
                       CONVERT_TZ(ci.check_in_time, 'UTC', COALESCE(l.timezone, 'America/New_York')) as local_check_in_time,
                       CONVERT_TZ(ci.check_out_time, 'UTC', COALESCE(l.timezone, 'America/New_York')) as local_check_out_time
                FROM check_ins ci
                JOIN members m ON ci.member_id = m.member_id
                JOIN locations l ON ci.location_id = l.location_id
                WHERE ci.club_id = ?
                ORDER BY ci.check_in_time DESC
                LIMIT 100
            `, [req.userClub.club_id], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
        
        res.render('checkins/index', {
            title: 'Checkins Management',
            checkins
        });
    } catch (error) {
        console.error('Checkins error:', error);
        req.flash('error', 'Error loading checkins');
        res.redirect('/dashboard');
    }
});

