export const logger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

    console.log(
      `${new Date().toISOString()} ${req.ip} ${req.method} ${req.originalUrl} ` +
      `${res.statusCode} ${durationMs.toFixed(1)}ms`
    );
  });

  next();
}