const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const cors = require('cors');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ldjypij.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
       // collections
    const MenuCollection = client.db('BistroDB').collection('menu')
    const ReviewsCollection = client.db('BistroDB').collection('reviews')
    const cartCollection = client.db("BistroDB").collection("carts");
    const userCollection = client.db("BistroDB").collection("users");
    const paymentCollection = client.db("BistroDB").collection("payments");



// /////////////////    JWT Api        ///////////////////////////////////

      app.post('/jwt', async (req, res) => {
        const user = req.body;
      
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
        res.send({ token });
        console.log(token ,user)
      })     

               // middlewares 
          const verifyToken = (req, res, next) => {
           console.log('inside verify token', req.headers.authorization);
          if (!req.headers.authorization) {
            return res.status(401).send({ message: 'unauthorized access' });
              }
               const token = req.headers.authorization.split(' ')[1];
                 jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
              if (err) {
                return res.status(401).send({ message: 'unauthorized access' })
               }
             req.decoded = decoded;
                     next();
             })
                         }
  // use verify admin after verifyToken
  const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.Email;
    const query = { Email: email };
    const user = await userCollection.findOne(query);
    const isAdmin = user?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    next();
  }
  

     // Get all reviews  data from db

      app.get('/review', async (req, res) => {
        const result = await ReviewsCollection.find().toArray()
  
        res.send(result)
      })
      // Added Order data in dataBASE
      app.post('/carts', async (req, res) => {
        const cartItem = req.body;
        const result = await cartCollection.insertOne(cartItem);
        res.send(result);
      });
         // Get all order data from db
        app.get('/carts', async (req, res) => {
      const email = req.query.email; 
          console.log(email, "vejalllllllllllllllllllllllllllllllllllllllllllllllllllll" )
         const query = { email : email };
          const result = await cartCollection.find(query).toArray();
          res.send(result);
        });

   // delete order dataaaaaa
        app.delete('/carts/:id', async (req, res) => {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) }
          const result = await cartCollection.deleteOne(query);
          res.send(result);
        })
    

  ///////////////////   users related api   /////////////////////////////

    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user)
      const query = { Email : user.Email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });
  // get all user data
  app.get('/users', verifyToken,  verifyAdmin,  async (req, res) => {
    const result = await userCollection.find().toArray();
    res.send(result);
  });
  //  Role Updated in User`S DATABASE   

  app.patch('/users/admin/:id',  async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
        role: 'admin'
      }
    }
    const result = await userCollection.updateOne(filter, updatedDoc);
    res.send(result);
  })

//  Delete User Data 

app.delete('/users/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await userCollection.deleteOne(query);
  res.send(result);
})

// BE A Admin ////

app.get('/users/admin/:email', verifyToken,  async (req, res) => {
  const email = req.params.email;
  console.log('user sssssssssssssssssssssssssssssssssssssss',email)
  

   console.log(req.decoded.Email)
  if (email !== req.decoded.Email) {
    return res.status(403).send({ message: 'forbidden access' })
  }

  const query = { Email: email };
  const user = await userCollection.findOne(query);
  let admin = false;
  if (user) {
    admin = user?.role === 'admin';
  }
  res.send({ admin });
})

/////////////////////////////    MENU Data       //// ///////////////////////////

 // Get all menu data from db
     app.get('/menu', async (req, res) => {
      const result = await MenuCollection.find().toArray()

      res.send(result)
    })    

// add menu data 
  
    app.post('/menu',verifyToken,verifyAdmin,  async (req, res) => {
      const Item = req.body;
      const result = await MenuCollection.insertOne(Item);
      res.send(result);
    });

// Menu DELETE 
    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await MenuCollection.deleteOne(query);
      res.send(result);
    })

//  updated 
    app.patch('/menu/:id', async (req, res) => {
      const item = req.body;
      console.log(item)
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }

      const result = await MenuCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })
    // payment   intent  
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });
          
//PAYMENT DATA SAVE IN DATABASE //////////////////////////////////////////
    app.post('/payments', async (req, res) => {
       const payment = req.body;
          const paymentResult = await paymentCollection.insertOne(payment);

       //  carefully delete each item from the cart
             console.log('payment info', payment);
              const query = {
                   _id: {
                $in: payment.cartIds.map(id => new ObjectId(id))
               }
              };

           const deleteResult = await cartCollection.deleteMany(query);

  res.send({ paymentResult, deleteResult });
})

 //////// // stats or analytics/////////////////////////////////////////////
    app.get('/admin-stats',  async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await MenuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      // this is not the best way
      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((total, payment) => total + payment.price, 0);

      // const result = await paymentCollection.aggregate([
      //   {
      //     $group: {
      //       _id: null,
      //       totalRevenue: {
      //         $sum: '$price'
      //       }
      //     }
      //   }
      // ]).toArray();
      // const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        menuItems,
        orders,
        revenue
      })
    })

    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
   
  }
}
run().catch(console.dir);
app.get('/', (req, res) => {
  res.send('boss is sitting')
})

app.listen(port, () => {
  console.log(`Bistro boss is sitting on port ${port}`);
})



