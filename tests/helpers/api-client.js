const request = require("supertest");

function api(app) {
    return {
        get: (url) => request(app).get(url).set("x-server-key", process.env.SERVER_API_KEY),
        post: (url) => request(app).post(url).set("x-server-key", process.env.SERVER_API_KEY),
        put: (url) => request(app).put(url).set("x-server-key", process.env.SERVER_API_KEY),
    };
}

module.exports = { api };