export const requireServerKey = (req, res, next) => {
    const key = req.get("x-server-key");
    const serverKey = process.env.SERVER_API_KEY;

    if (!serverKey || !key || key !== serverKey) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    next();
};