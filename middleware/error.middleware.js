const isProd = process.env.NODE_ENV !== "test";

export const errorHandler = (err, req, res, next) => {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);

    res.status(500).json({
        error: "Internal server error",
        ...(isProd ? {} : { stack: err.stack }),
    });
};