//Aula 1 - Server básico e Endpoints
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var port = process.env.PORT || 3000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", function (req, res) {
  res.send("Teobaldo!");
});
app.get("/code", function (req, res) {
  res.redirect("https://httpstatusdogs.com/" + res.statusCode);
});
app.get("/html", function (req, res) {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HTML Response</title>
    </head>
    <body>
        <h1>Hello, this is an HTML response!</h1>
        <p>You can include any HTML content here.</p>
    </body>
    </html>
`);
});
app.post("/cadastro", function (req, res) {
  console.log(req.body);
  console.log("Recebi um dado");
  let nome = req.body.nome;
  let senha = req.body.senha;
  console.log(`Nome: ${nome} Senha: ${senha}`);
  res.send("Recebido");
});
//Aula 2 - Banco de Dados
var sqlite3 = require("sqlite3").verbose();
var DBPATH = "appBD.db";
var db = new sqlite3.Database(DBPATH);
app.get("/tudo", function (req, res) {
  db.all(`SELECT * FROM users`, [], (err, rows) => {
    if (err) {
      res.send(err);
    }
    res.send(rows);
  });
});

app.post("/criarUsuario", function (req, res) {
  var nome = req.body.nome;
  var cpf = req.body.cpf;
  sqlBusca = `SELECT * FROM users WHERE cpf = ${cpf}`;
  db.all(sqlBusca, [], (err, rows) => {
    if (err) {
      res.send("erro na consulta: " + err);
    } else {
      res.send("Usuário já cadastrado: " + rows);
    }
  });
});

app.listen(port);
