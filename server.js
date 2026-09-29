const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "help-please-secret-2026";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "help_please",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD
});

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const mailer = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

pool.connect()
    .then(client => {
        console.log("PostgreSQL Database Connected");
        client.release();
    })
    .catch(error => {
        console.error("Database Connection Failed:", error.message);
    });

async function prepareDatabase() {
    try {
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS reset_token TEXT
        `);

        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                message_id SERIAL PRIMARY KEY,
                request_id INTEGER NOT NULL,
                sender_type VARCHAR(20) NOT NULL,
                sender_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Database structure ready");
    } catch (error) {
        console.error("Database preparation failed:", error.message);
    }
}

prepareDatabase();

function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({
            success: false,
            message: "Login required"
        });
    }

    const parts = header.split(" ");

    if (parts.length !== 2) {
        return res.status(401).json({
            success: false,
            message: "Invalid authorization"
        });
    }

    try {
        req.user = jwt.verify(parts[1], JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

function createToken(user) {
    return jwt.sign(
        {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role,
            volunteer_id: user.volunteer_id || null
        },
        JWT_SECRET,
        {
            expiresIn: "12h"
        }
    );
}

async function getUserWithRole(userId) {
    const result = await pool.query(
        `SELECT
            u.user_id,
            u.name,
            u.email,
            v.volunteer_id
         FROM users u
         LEFT JOIN volunteers v
         ON u.user_id=v.user_id
         WHERE u.user_id=$1`,
        [userId]
    );

    if (!result.rows.length) {
        return null;
    }

    const row = result.rows[0];

    return {
        user_id: row.user_id,
        name: row.name,
        email: row.email,
        role: row.volunteer_id ? "VOLUNTEER" : "USER",
        volunteer_id: row.volunteer_id || null
    };
}

app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "Help Please Backend is running"
    });
});

app.post("/api/register", async (req, res) => {
    try {
        const {
            name,
            email,
            password
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const existing = await pool.query(
            "SELECT user_id FROM users WHERE email=$1",
            [email]
        );

        if (existing.rows.length) {
            return res.status(400).json({
                success: false,
                message: "Email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users
                (name,email,password_hash)
             VALUES ($1,$2,$3)
             RETURNING user_id,name,email`,
            [
                name,
                email,
                passwordHash
            ]
        );

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
});

app.post("/api/register-volunteer", async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            name,
            email,
            password,
            phone
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        await client.query("BEGIN");

        const existing = await client.query(
            "SELECT user_id FROM users WHERE email=$1",
            [email]
        );

        if (existing.rows.length) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const userResult = await client.query(
            `INSERT INTO users
                (name,email,password_hash)
             VALUES ($1,$2,$3)
             RETURNING user_id,name,email`,
            [
                name,
                email,
                passwordHash
            ]
        );

        const volunteerResult = await client.query(
            `INSERT INTO volunteers
                (user_id,phone)
             VALUES ($1,$2)
             RETURNING volunteer_id,user_id,phone`,
            [
                userResult.rows[0].user_id,
                phone || null
            ]
        );

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            message: "Volunteer registered successfully",
            user: userResult.rows[0],
            volunteer: volunteerResult.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Volunteer registration failed"
        });

    } finally {
        client.release();
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        const result = await pool.query(
            `SELECT
                user_id,
                name,
                email,
                password_hash
             FROM users
             WHERE email=$1`,
            [email]
        );

        if (!result.rows.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        const match = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!match) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const userData = await getUserWithRole(
            user.user_id
        );

        const token = createToken(userData);

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: userData
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
});

app.post("/api/google-login", async (req, res) => {
    try {
        const {
            credential
        } = req.body;

        if (!GOOGLE_CLIENT_ID) {
            return res.status(500).json({
                success: false,
                message: "Google login is not configured"
            });
        }

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Google credential required"
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            return res.status(401).json({
                success: false,
                message: "Invalid Google account"
            });
        }

        const email = payload.email;
        const name =
            payload.name ||
            email.split("@")[0];

        let result = await pool.query(
            `SELECT
                user_id,
                name,
                email
             FROM users
             WHERE email=$1`,
            [email]
        );

        let userId;

        if (!result.rows.length) {
            const randomPassword =
                crypto.randomBytes(32).toString("hex");

            const passwordHash =
                await bcrypt.hash(
                    randomPassword,
                    10
                );

            const newUser = await pool.query(
                `INSERT INTO users
                    (name,email,password_hash)
                 VALUES ($1,$2,$3)
                 RETURNING user_id`,
                [
                    name,
                    email,
                    passwordHash
                ]
            );

            userId =
                newUser.rows[0].user_id;

        } else {
            userId =
                result.rows[0].user_id;
        }

        const userData =
            await getUserWithRole(userId);

        const token =
            createToken(userData);

        res.json({
            success: true,
            message: "Google login successful",
            token,
            user: userData
        });

    } catch (error) {
        console.error(
            "Google login error:",
            error
        );

        res.status(401).json({
            success: false,
            message: "Google login failed"
        });
    }
});

app.post("/api/forgot-password", async (req, res) => {
    try {
        const {
            email
        } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const result = await pool.query(
            `SELECT
                user_id,
                name,
                email
             FROM users
             WHERE email=$1`,
            [email]
        );

        if (!result.rows.length) {
            return res.json({
                success: true,
                message:
                    "If this email exists, a reset link has been sent."
            });
        }

        if (
            !process.env.EMAIL_USER ||
            !process.env.EMAIL_PASS
        ) {
            return res.status(500).json({
                success: false,
                message:
                    "Email service is not configured"
            });
        }

        const user = result.rows[0];

        const resetToken =
            crypto.randomBytes(32).toString("hex");

        const expires =
            new Date(
                Date.now() +
                30 * 60 * 1000
            );

        await pool.query(
            `UPDATE users
             SET reset_token=$1,
                 reset_token_expires=$2
             WHERE user_id=$3`,
            [
                resetToken,
                expires,
                user.user_id
            ]
        );

        const appUrl =
            process.env.APP_URL ||
            "http://localhost:3000";

        const resetLink =
            `${appUrl}/reset-password.html?token=${resetToken}`;

        await mailer.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Help Please Password Reset",
            html: `
                <div style="font-family:Arial,sans-serif">
                    <h2>Help Please Password Reset</h2>
                    <p>Hello ${user.name},</p>
                    <p>Click the button below to reset your password.</p>
                    <p>
                        <a
                            href="${resetLink}"
                            style="
                                display:inline-block;
                                padding:12px 20px;
                                background:#8060d0;
                                color:#ffffff;
                                text-decoration:none;
                                border-radius:8px;
                            "
                        >
                            Reset Password
                        </a>
                    </p>
                    <p>This link will expire in 30 minutes.</p>
                </div>
            `
        });

        res.json({
            success: true,
            message: "Password reset link sent"
        });

    } catch (error) {
        console.error(
            "Forgot password error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Could not send reset email"
        });
    }
});

app.post("/api/reset-password", async (req, res) => {
    try {
        const {
            token,
            password
        } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: "Token and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message:
                    "Password must be at least 6 characters"
            });
        }

        const result = await pool.query(
            `SELECT user_id
             FROM users
             WHERE reset_token=$1
             AND reset_token_expires > CURRENT_TIMESTAMP`,
            [token]
        );

        if (!result.rows.length) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid or expired reset link"
            });
        }

        const passwordHash =
            await bcrypt.hash(
                password,
                10
            );

        await pool.query(
            `UPDATE users
             SET password_hash=$1,
                 reset_token=NULL,
                 reset_token_expires=NULL
             WHERE user_id=$2`,
            [
                passwordHash,
                result.rows[0].user_id
            ]
        );

        res.json({
            success: true,
            message:
                "Password reset successful"
        });

    } catch (error) {
        console.error(
            "Reset password error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Password reset failed"
        });
    }
});

app.post("/api/help-request", authenticate, async (req, res) => {
    try {
        const {
            task_description,
            location_text,
            latitude,
            longitude
        } = req.body;

        if (!task_description || !location_text) {
            return res.status(400).json({
                success: false,
                message:
                    "Task and location are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO help_requests
                (
                    user_id,
                    task_description,
                    location_text,
                    latitude,
                    longitude
                )
             VALUES ($1,$2,$3,$4,$5)
             RETURNING *`,
            [
                req.user.user_id,
                task_description,
                location_text,
                latitude || null,
                longitude || null
            ]
        );

        res.status(201).json({
            success: true,
            message:
                "Help request created",
            request:
                result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message:
                "Could not create help request"
        });
    }
});

app.get("/api/help-requests", authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                hr.request_id,
                hr.user_id,
                u.name AS requester_name,
                hr.task_description,
                hr.location_text,
                hr.latitude,
                hr.longitude,
                hr.status,
                hr.accepted_by,
                hr.created_at,
                hr.accepted_at
             FROM help_requests hr
             JOIN users u
             ON hr.user_id=u.user_id
             ORDER BY hr.created_at DESC`
        );

        res.json({
            success: true,
            requests:
                result.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message:
                "Could not load requests"
        });
    }
});

app.post(
    "/api/help-request/:requestId/accept",
    authenticate,
    async (req, res) => {
        try {
            const volunteer =
                await pool.query(
                    `SELECT volunteer_id
                     FROM volunteers
                     WHERE user_id=$1`,
                    [req.user.user_id]
                );

            if (!volunteer.rows.length) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Only volunteers can accept requests"
                });
            }

            const volunteerId =
                volunteer.rows[0].volunteer_id;

            const result =
                await pool.query(
                    `UPDATE help_requests
                     SET
                        status='ACCEPTED',
                        accepted_by=$1,
                        accepted_at=CURRENT_TIMESTAMP
                     WHERE request_id=$2
                     AND status='PENDING'
                     RETURNING *`,
                    [
                        volunteerId,
                        req.params.requestId
                    ]
                );

            if (!result.rows.length) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Request already accepted or unavailable"
                });
            }

            io.to(
                `request_${req.params.requestId}`
            ).emit(
                "helpAccepted",
                result.rows[0]
            );

            res.json({
                success: true,
                message:
                    "Help request accepted",
                request:
                    result.rows[0]
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    "Could not accept request"
            });
        }
    }
);

app.post(
    "/api/help-request/:requestId/complete",
    authenticate,
    async (req, res) => {
        try {
            const result =
                await pool.query(
                    `UPDATE help_requests
                     SET status='COMPLETED'
                     WHERE request_id=$1
                     AND user_id=$2
                     AND status='ACCEPTED'
                     RETURNING *`,
                    [
                        req.params.requestId,
                        req.user.user_id
                    ]
                );

            if (!result.rows.length) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Request cannot be completed"
                });
            }

            io.to(
                `request_${req.params.requestId}`
            ).emit(
                "helpCompleted",
                result.rows[0]
            );

            res.json({
                success: true,
                message:
                    "Task completed",
                request:
                    result.rows[0]
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    "Could not complete request"
            });
        }
    }
);

app.post(
    "/api/volunteer/location",
    authenticate,
    async (req, res) => {
        try {
            const {
                latitude,
                longitude
            } = req.body;

            if (
                latitude === undefined ||
                longitude === undefined
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Latitude and longitude are required"
                });
            }

            const result =
                await pool.query(
                    `UPDATE volunteers
                     SET
                        latitude=$1,
                        longitude=$2,
                        location_updated_at=CURRENT_TIMESTAMP
                     WHERE user_id=$3
                     RETURNING
                        volunteer_id,
                        latitude,
                        longitude,
                        location_updated_at`,
                    [
                        latitude,
                        longitude,
                        req.user.user_id
                    ]
                );

            if (!result.rows.length) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Volunteer account required"
                });
            }

            const volunteer =
                result.rows[0];

            const requests =
                await pool.query(
                    `SELECT request_id
                     FROM help_requests
                     WHERE accepted_by=$1
                     AND status='ACCEPTED'`,
                    [
                        volunteer.volunteer_id
                    ]
                );

            requests.rows.forEach(request => {
                io.to(
                    `request_${request.request_id}`
                ).emit(
                    "volunteerLocation",
                    volunteer
                );
            });

            res.json({
                success: true,
                location:
                    volunteer
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    "Location update failed"
            });
        }
    }
);

app.get(
    "/api/help-request/:requestId/volunteer-location",
    authenticate,
    async (req, res) => {
        try {
            const result =
                await pool.query(
                    `SELECT
                        v.volunteer_id,
                        u.name AS volunteer_name,
                        v.latitude,
                        v.longitude,
                        v.location_updated_at
                     FROM help_requests hr
                     JOIN volunteers v
                     ON hr.accepted_by=v.volunteer_id
                     JOIN users u
                     ON v.user_id=u.user_id
                     WHERE hr.request_id=$1
                     AND hr.user_id=$2
                     AND hr.status='ACCEPTED'`,
                    [
                        req.params.requestId,
                        req.user.user_id
                    ]
                );

            if (!result.rows.length) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Volunteer location not available"
                });
            }

            res.json({
                success: true,
                volunteer:
                    result.rows[0]
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    "Could not get volunteer location"
            });
        }
    }
);

async function checkChatAccess(
    requestId,
    userId
) {
    const requestResult =
        await pool.query(
            `SELECT
                request_id,
                user_id,
                accepted_by,
                status
             FROM help_requests
             WHERE request_id=$1`,
            [requestId]
        );

    if (!requestResult.rows.length) {
        return null;
    }

    const request =
        requestResult.rows[0];

    const volunteerResult =
        await pool.query(
            `SELECT volunteer_id
             FROM volunteers
             WHERE user_id=$1`,
            [userId]
        );

    const isUser =
        Number(request.user_id) ===
        Number(userId);

    const isVolunteer =
        volunteerResult.rows.length > 0 &&
        Number(request.accepted_by) ===
        Number(
            volunteerResult.rows[0].volunteer_id
        );

    if (!isUser && !isVolunteer) {
        return {
            allowed: false
        };
    }

    if (request.status !== "ACCEPTED") {
        return {
            allowed: false,
            message:
                "Chat is available after the request is accepted"
        };
    }

    return {
        allowed: true,
        request,
        volunteerId:
            volunteerResult.rows.length
                ? volunteerResult.rows[0].volunteer_id
                : null,
        isUser
    };
}

app.get(
    "/api/chat/:requestId",
    authenticate,
    async (req, res) => {
        try {
            const access =
                await checkChatAccess(
                    req.params.requestId,
                    req.user.user_id
                );

            if (!access) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Help request not found"
                });
            }

            if (!access.allowed) {
                return res.status(403).json({
                    success: false,
                    message:
                        access.message ||
                        "Chat access denied"
                });
            }

            const messages =
                await pool.query(
                    `SELECT
                        message_id,
                        request_id,
                        sender_type,
                        sender_id,
                        message,
                        created_at
                     FROM messages
                     WHERE request_id=$1
                     ORDER BY created_at ASC`,
                    [req.params.requestId]
                );

            res.json({
                success: true,
                messages:
                    messages.rows
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    "Could not load chat"
            });
        }
    }
);

app.post(
    "/api/chat/:requestId",
    authenticate,
    async (req, res) => {
        try {
            const {
                message
            } = req.body;

            if (
                !message ||
                !message.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Message is required"
                });
            }

            const access =
                await checkChatAccess(
                    req.params.requestId,
                    req.user.user_id
                );

            if (!access) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Help request not found"
                });
            }

            if (!access.allowed) {
                return res.status(403).json({
                    success: false,
                    message:
                        access.message ||
                        "Chat access denied"
                });
            }

            const senderType =
                access.isUser
                    ? "USER"
                    : "VOLUNTEER";

            const senderId =
                access.isUser
                    ? req.user.user_id
                    : access.volunteerId;

            const result =
                await pool.query(
                    `INSERT INTO messages
                        (
                            request_id,
                            sender_type,
                            sender_id,
                            message
                        )
                     VALUES ($1,$2,$3,$4)
                     RETURNING
                        message_id,
                        request_id,
                        sender_type,
                        sender_id,
                        message,
                        created_at`,
                    [
                        req.params.requestId,
                        senderType,
                        senderId,
                        message.trim()
                    ]
                );

            io.to(
                `request_${req.params.requestId}`
            ).emit(
                "newMessage",
                result.rows[0]
            );

            res.json({
                success: true,
                message:
                    result.rows[0]
            });

        } catch (error) {
            console.error(
                "POST CHAT ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to send message"
            });
        }
    }
);

io.on("connection", socket => {

    socket.on(
        "joinHelpChat",
        async data => {
            try {
                const {
                    requestId,
                    token
                } = data;

                if (!requestId || !token) {
                    return;
                }

                const user =
                    jwt.verify(
                        token,
                        JWT_SECRET
                    );

                const access =
                    await checkChatAccess(
                        requestId,
                        user.user_id
                    );

                if (
                    !access ||
                    !access.allowed
                ) {
                    return;
                }

                socket.join(
                    `request_${requestId}`
                );

            } catch (error) {
                console.error(
                    "Socket authentication error:",
                    error.message
                );
            }
        }
    );

    socket.on(
        "sendMessage",
        async data => {
            try {
                const {
                    requestId,
                    token,
                    message
                } = data;

                if (
                    !requestId ||
                    !token ||
                    !message ||
                    !message.trim()
                ) {
                    return;
                }

                const user =
                    jwt.verify(
                        token,
                        JWT_SECRET
                    );

                const access =
                    await checkChatAccess(
                        requestId,
                        user.user_id
                    );

                if (
                    !access ||
                    !access.allowed
                ) {
                    return;
                }

                const senderType =
                    access.isUser
                        ? "USER"
                        : "VOLUNTEER";

                const senderId =
                    access.isUser
                        ? user.user_id
                        : access.volunteerId;

                const result =
                    await pool.query(
                        `INSERT INTO messages
                            (
                                request_id,
                                sender_type,
                                sender_id,
                                message
                            )
                         VALUES ($1,$2,$3,$4)
                         RETURNING
                            message_id,
                            request_id,
                            sender_type,
                            sender_id,
                            message,
                            created_at`,
                        [
                            requestId,
                            senderType,
                            senderId,
                            message.trim()
                        ]
                    );

                io.to(
                    `request_${requestId}`
                ).emit(
                    "newMessage",
                    result.rows[0]
                );

            } catch (error) {
                console.error(
                    "Message error:",
                    error.message
                );
            }
        }
    );
});

server.listen(PORT, () => {
    console.log("=================================");
    console.log("      HELP PLEASE WEB APP");
    console.log("=================================");
    console.log(
        `Server: http://localhost:${PORT}`
    );
    console.log(
        "Database: help_please"
    );
    console.log(
        "Real-time chat: enabled"
    );
    console.log(
        "Live location: enabled"
    );
    console.log(
        "Google Login: enabled"
    );
    console.log(
        "Forgot Password: enabled"
    );
    console.log("=================================");
});