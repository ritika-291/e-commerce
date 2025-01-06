const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');
const app = express();
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ecommerce', {
    // Remove deprecated options
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Add session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // set to true if using https
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetCode: { type: String },
    resetCodeExpires: { type: Date },
    cart: [{
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
        image: String
    }]
});

const User = mongoose.model('User', userSchema);

// Routes
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const user = new User({
            username,
            email,
            password: hashedPassword
        });

        await user.save();
        res.redirect('/login.html');

    } catch (error) {
        res.status(500).json({ message: 'Error creating user' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Set session data
        req.session.user = {
            email: user.email,
            username: user.username,
            cart: user.cart
        };

        res.json({ 
            message: 'Login successful',
            user: {
                email: user.email,
                username: user.username,
                cart: user.cart
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Error logging in' });
    }
});

app.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ message: 'Email not found' });
        }

        // Generate reset code
        const resetCode = crypto.randomBytes(3).toString('hex');
        const resetCodeExpires = new Date(Date.now() + 3600000); // 1 hour

        // Save reset code to user
        user.resetCode = resetCode;
        user.resetCodeExpires = resetCodeExpires;
        await user.save();

        // Send email with reset code
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'your-email@gmail.com', // Replace with your email
                pass: 'your-password'         // Replace with your password
            }
        });

        await transporter.sendMail({
            from: 'your-email@gmail.com',
            to: email,
            subject: 'Password Reset Code',
            text: `Your password reset code is: ${resetCode}`
        });

        res.json({ message: 'Reset code sent to email' });

    } catch (error) {
        res.status(500).json({ message: 'Error processing request' });
    }
});

app.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        const user = await User.findOne({ 
            email,
            resetCode: code,
            resetCodeExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }

        // Update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetCode = undefined;
        user.resetCodeExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successful' });

    } catch (error) {
        res.status(500).json({ message: 'Error resetting password' });
    }
});

app.post('/add-to-cart', async (req, res) => {
    try {
        const { email, product } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if product already exists in cart
        const existingProduct = user.cart.find(item => item.productId === product.productId);
        
        if (existingProduct) {
            existingProduct.quantity += 1;
        } else {
            user.cart.push({
                ...product,
                quantity: 1
            });
        }

        await user.save();
        res.json({ message: 'Product added to cart', cart: user.cart });

    } catch (error) {
        res.status(500).json({ message: 'Error adding to cart' });
    }
});

app.get('/get-cart/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user.cart);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching cart' });
    }
});

app.post('/update-cart-quantity', async (req, res) => {
    try {
        const { email, productId, quantity } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const cartItem = user.cart.find(item => item.productId === productId);
        if (cartItem) {
            if (quantity <= 0) {
                user.cart = user.cart.filter(item => item.productId !== productId);
            } else {
                cartItem.quantity = quantity;
            }
            await user.save();
        }

        res.json({ message: 'Cart updated', cart: user.cart });
    } catch (error) {
        res.status(500).json({ message: 'Error updating cart' });
    }
});

// Add logout route
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

const getAvailablePort = async (startPort) => {
    const net = require('net');
    
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        
        server.listen(startPort, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
        
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(getAvailablePort(startPort + 1));
            } else {
                reject(err);
            }
        });
    });
};

const startServer = async () => {
    try {
        const PORT = await getAvailablePort(3000);
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
};

startServer(); 