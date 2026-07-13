export const validate = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse({
            params: req.params,
            query: req.query,
            body: req.body,
        });

        if (!result.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: result.error.issues,
            });
        }

        req.validated = result.data;

        next();
    };
};