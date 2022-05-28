const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rl6dv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const toolsCollection = client.db('ToolKits').collection('tools');
        const reviewCollection = client.db('ToolKits').collection('reviews');

        // JWT Authentication
        app.post('/login', (req, res) => {
            const user = req.body;
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d'
            });
            res.send({ accessToken });
        });

        // Get Tools
        app.get('/tools', async (req, res) => {
            const query = {};
            const tools = await toolsCollection.find(query).toArray();
            res.send(tools);
        })

        // Post Reviews
        app.post('/add-review', async (req, res) => {
            const review = req.body;
            await reviewCollection.insertOne(review);
            res.send({ success: true });        
        });

        //get all reviews
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find({}).toArray();
            res.send(result);
        })

     }
    finally {}
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Running Server');
})


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})