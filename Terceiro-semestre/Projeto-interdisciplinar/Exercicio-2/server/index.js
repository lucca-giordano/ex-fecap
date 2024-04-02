const express = require('express');
const app = express();
const PORT = 3000;
const mongoClient  = require('mongodb').MongoClient;
const url = 'mongodb://localhost:27017';

app.use(express.json());

mongoClient.connect(url, (err, db) => {
    if (err){
        console.log('Error while connecting mongo client!');
    }else{
        const myDb = db.db('myDb');
        const collection = myDb.collection('myTable');
        app.post('/singup', (req, res) => {
            const newUser = {
                name: req.body.name,
                email: req.body.email,
                password: req.body.password
            };

            const query = {email: newUser.email};
            collection.findOne(query, (err, result) =>{
                if(result == null){
                    collection.insertOne(newUser, (err, res) => {
                        res.status(200).send();
                    });
                }else{
                    res.status(400).send();
                }
            });
        });


        app.post('/login', (req, res) => {
            const query = {
                email: req.body.email,
                password: req.body.password
            };

            collection.findOne(query, (err, result) => {
                if(result != null){
                    const objSend = {
                        name: result.name,
                        email: result.email
                    };
                    res.status(200).send(JSON.stringify(objSend));
                }else{
                    res.status(404).send();
                }
            })
        
        })
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})