// // const express = require("express");
// // const cors = require("cors");

// // const app = express();

// // app.use(cors({ origin: "*" }));
// // app.use(express.json());

// // app.get("/", (req, res) => {
// // res.send("SmartNudge API Running...");
// // });

// // app.use("/ai", require("./modules/ai/ai.routes"));

// // module.exports = app;

// const express = require("express");
// const cors = require("cors");

// const app = express();


// const notesRoutes = require('./modules/notes/notes.routes');

// const app = express();

// app.use(cors());
// app.use(express.json());

// app.use('/api/notes', notesRoutes);

// module.exports = app;

// app.use(cors({ origin: "*" }));
// app.use(express.json());

// app.get("/", (req, res) => {
//     res.send("SmartNudge API Running...");
// });

// module.exports = app;

const express = require("express");

const cors = require("cors");

const notesRoutes =
require("./modules/notes/notes.routes");

const app = express();

app.use(cors({
    origin: "*"
}));

app.use(express.json());

app.use("/uploads",
    express.static("uploads")
);

app.get("/", (req, res) => {

    res.send(
        "SmartNudge API Running"
    );
});

app.use(
    "/api/notes",
    notesRoutes
);

module.exports = app;