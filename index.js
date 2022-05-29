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

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const toolsCollection = client.db('ToolKits').collection('tools');
        const reviewCollection = client.db('ToolKits').collection('reviews');
        const userCollection = client.db('ToolKits').collection('users');
        const orderCollection = client.db('ToolKits').collection('orders');
        const paymentCollection = client.db('ToolKits').collection('payments');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

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

        // Get Tools
        app.post('/tools', async (req, res) => {
            const tool = req.body;
            const result = await toolsCollection.insertOne(tool);
            res.send({ success: true });
        })

        //delete Tools
        app.delete('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const result = await toolsCollection.deleteOne({ _id: ObjectId(id) });
            res.send({ success: true })
        })

        //single service
        app.get('/tools/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.findOne(query)
            res.send(result);
        });

        //update service
        app.put('/tools/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: ObjectId(id) };
            const newService = req.body;
            const { available } = newService;
            const options = { upsert: true };
            const updateDoc = {
                $set: { available },
            };
            const result = await toolsCollection.updateOne(query, updateDoc, options);
            res.send({ message: 'updated' });
        });

        //specific order by query 
        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await orderCollection.find(query).toArray();
            res.send(result);
        });

        //sending to orders db
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send({ success: true });
        });

        //all orders for admin
        app.get('/all-orders', async (req, res) => {
            const result = await orderCollection.find({}).toArray();
            res.send(result);
        });

        //delete order
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send({ success: true, result });
        });

        //shipping
        app.patch('/ship-order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const updateDoc = {
                $set: { shipped: true },
            };
            const result = await orderCollection.updateOne(query, updateDoc);
            res.send({ success: true });
        });

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

        //for user and setting up jwt
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET)
            res.send({ result, token });
        });

        //accessing an user
        app.get('/user', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        });

        //adding more info of an user
        app.put('/user-info-update/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const updatedInfo = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: updatedInfo,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            // const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET)
            res.send({ success: true });
        });

        //adding more info of an user
        app.put('/user-update/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: {role: 'admin'},
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            // const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET)
            res.send({ success: true });
        });

        //user admin or not
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        //getting all users for admin
        app.get('/all-users', async (req, res) => {
            const users = await userCollection.find({}).toArray();
            res.send(users);
        });

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