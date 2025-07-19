import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';

// Ensure Tailwind CSS is loaded (assumed by the environment)
// <script src="https://cdn.tailwindcss.com"></script>

// Context for Auth and Firestore instances
const AppContext = createContext(null);

// Main App Component
function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [currentUser, setCurrentUser] = useState(null); // Firebase User object
    const [userId, setUserId] = useState(null); // Firebase User UID
    const [products, setProducts] = useState([]);
    const [cartItems, setCartItems] = useState([]);
    const [currentPage, setCurrentPage] = useState('home'); // 'home', 'productDetail', 'cart', 'checkout', 'login', 'register', 'orderConfirmation'
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const modalRef = useRef(null);

    // Firebase Initialization and Authentication
    useEffect(() => {
        try {
            const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestore);
            setAuth(firebaseAuth);

            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

            // Sign in anonymously or with custom token
            const signInUser = async () => {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(firebaseAuth, initialAuthToken);
                    } else {
                        await signInAnonymously(firebaseAuth);
                    }
                } catch (error) {
                    console.error("Error during initial sign-in:", error);
                    showUserMessage("Failed to sign in. Please refresh.");
                } finally {
                    setIsLoading(false);
                }
            };

            signInUser();

            // Auth state change listener
            const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
                setCurrentUser(user);
                setUserId(user ? user.uid : null);
                console.log("Auth state changed. User:", user ? user.uid : "None");
                if (user && currentPage === 'login' || currentPage === 'register') {
                    setCurrentPage('home'); // Redirect to home after successful auth
                }
            });

            return () => unsubscribeAuth();
        } catch (error) {
            console.error("Firebase initialization error:", error);
            showUserMessage("Failed to initialize the app. Please try again.");
            setIsLoading(false);
        }
    }, []);

    // Firestore Listener for Products
    useEffect(() => {
        if (!db) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/products`);

        const unsubscribeProducts = onSnapshot(productsCollectionRef, (snapshot) => {
            const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(fetchedProducts);
            if (fetchedProducts.length === 0) {
                // If no products, add some dummy data for demonstration
                addDummyProducts(productsCollectionRef);
            }
        }, (error) => {
            console.error("Error fetching products:", error);
            if (error.code === 'permission-denied') {
                showUserMessage("Failed to load products. Please check your Firebase Firestore security rules for the 'products' collection.");
            } else {
                showUserMessage("Failed to load products. Please try again later.");
            }
        });

        return () => unsubscribeProducts();
    }, [db]);

    // Dummy product data for initial setup
    const addDummyProducts = async (productsCollectionRef) => {
        const dummyProducts = [
            {
                name: "Wireless Headphones",
                description: "High-fidelity sound with comfortable earcups and long battery life. Perfect for music lovers.",
                price: 99.99,
                imageUrl: "https://placehold.co/300x200/4F46E5/ffffff?text=Headphones",
                stock: 50
            },
            {
                name: "Smartwatch Pro",
                description: "Track your fitness, receive notifications, and make calls right from your wrist. Waterproof design.",
                price: 199.99,
                imageUrl: "https://placehold.co/300x200/EC4899/ffffff?text=Smartwatch",
                stock: 30
            },
            {
                name: "Portable Bluetooth Speaker",
                description: "Compact and powerful speaker with rich bass. Ideal for outdoor adventures and parties.",
                price: 49.99,
                imageUrl: "https://placehold.co/300x200/10B981/ffffff?text=Speaker",
                stock: 75
            },
            {
                name: "Ergonomic Office Chair",
                description: "Designed for ultimate comfort and support during long working hours. Adjustable features.",
                price: 249.99,
                imageUrl: "https://placehold.co/300x200/F59E0B/ffffff?text=Office+Chair",
                stock: 20
            },
            {
                name: "4K LED Smart TV",
                description: "Experience stunning visuals and smart features with this immersive 4K television. Large display.",
                price: 799.99,
                imageUrl: "https://placehold.co/300x200/06B6D4/ffffff?text=4K+TV",
                stock: 15
            }
        ];

        try {
            const snapshot = await getDocs(productsCollectionRef);
            if (snapshot.empty) { // Only add if collection is empty
                for (const product of dummyProducts) {
                    await addDoc(productsCollectionRef, product);
                }
                console.log("Dummy products added to Firestore.");
            }
        } catch (error) {
            console.error("Error adding dummy products:", error);
        }
    };

    // --- Modal Logic ---
    const showUserMessage = (message) => {
        setModalMessage(message);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setModalMessage('');
    };

    // Handle clicks outside the modal to close it
    useEffect(() => {
        function handleClickOutside(event) {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                closeModal();
            }
        }
        if (showModal) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showModal]);

    // --- Cart Management ---
    const addToCart = (product, quantity = 1) => {
        const existingItemIndex = cartItems.findIndex(item => item.id === product.id);
        if (existingItemIndex > -1) {
            const updatedCart = [...cartItems];
            updatedCart[existingItemIndex].quantity += quantity;
            setCartItems(updatedCart);
        } else {
            setCartItems([...cartItems, { ...product, quantity }]);
        }
        showUserMessage(`${product.name} added to cart!`);
    };

    const updateCartQuantity = (productId, newQuantity) => {
        if (newQuantity <= 0) {
            removeFromCart(productId);
            return;
        }
        setCartItems(cartItems.map(item =>
            item.id === productId ? { ...item, quantity: newQuantity } : item
        ));
    };

    const removeFromCart = (productId) => {
        setCartItems(cartItems.filter(item => item.id !== productId));
        showUserMessage("Item removed from cart.");
    };

    const getCartTotal = () => {
        return cartItems.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2);
    };

    // --- Order Processing ---
    const placeOrder = async () => {
        if (!db || !userId) {
            showUserMessage("Please log in to place an order.");
            return;
        }
        if (cartItems.length === 0) {
            showUserMessage("Your cart is empty!");
            return;
        }

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        try {
            const orderRef = await addDoc(collection(db, `artifacts/${appId}/public/data/orders`), {
                userId: userId,
                items: cartItems.map(item => ({
                    productId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity
                })),
                totalAmount: parseFloat(getCartTotal()),
                timestamp: Date.now(),
                status: 'pending' // e.g., 'pending', 'shipped', 'delivered'
            });
            setCartItems([]); // Clear cart after order
            setCurrentPage('orderConfirmation');
            showUserMessage(`Order placed successfully! Order ID: ${orderRef.id}`);
        } catch (error) {
            console.error("Error placing order:", error);
            showUserMessage("Failed to place order. Please try again.");
        }
    };

    // --- Authentication Handlers ---
    const handleRegister = async (email, password) => {
        if (!auth) return;
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            showUserMessage("Registration successful! You are now logged in.");
            setCurrentPage('home');
        } catch (error) {
            console.error("Registration error:", error);
            showUserMessage(`Registration failed: ${error.message}`);
        }
    };

    const handleLogin = async (email, password) => {
        if (!auth) return;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showUserMessage("Login successful!");
            setCurrentPage('home');
        } catch (error) {
            console.error("Login error:", error);
            showUserMessage(`Login failed: ${error.message}`);
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setCartItems([]); // Clear cart on logout
            showUserMessage("Logged out successfully.");
            setCurrentPage('home');
        } catch (error) {
            console.error("Logout error:", error);
            showUserMessage(`Logout failed: ${error.message}`);
        }
    };

    // --- Conditional Rendering for Pages ---
    const renderPage = () => {
        switch (currentPage) {
            case 'home':
                return <ProductList products={products} addToCart={addToCart} setCurrentPage={setCurrentPage} setSelectedProductId={setSelectedProductId} />;
            case 'productDetail':
                const product = products.find(p => p.id === selectedProductId);
                return product ? <ProductDetail product={product} addToCart={addToCart} setCurrentPage={setCurrentPage} /> : <p className="text-center text-gray-600">Product not found.</p>;
            case 'cart':
                return <Cart cartItems={cartItems} updateCartQuantity={updateCartQuantity} removeFromCart={removeFromCart} getCartTotal={getCartTotal} setCurrentPage={setCurrentPage} userId={userId} />;
            case 'checkout':
                return <Checkout cartItems={cartItems} getCartTotal={getCartTotal} placeOrder={placeOrder} setCurrentPage={setCurrentPage} />;
            case 'login':
                return <AuthForm type="login" onSubmit={handleLogin} setCurrentPage={setCurrentPage} />;
            case 'register':
                return <AuthForm type="register" onSubmit={handleRegister} setCurrentPage={setCurrentPage} />;
            case 'orderConfirmation':
                return <OrderConfirmation setCurrentPage={setCurrentPage} />;
            default:
                return <ProductList products={products} addToCart={addToCart} setCurrentPage={setCurrentPage} setSelectedProductId={setSelectedProductId} />;
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="text-center text-gray-600">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    <p>Loading application...</p>
                    <p className="text-sm mt-2">If this takes long, please refresh the page.</p>
                </div>
            </div>
        );
    }

    return (
        <AppContext.Provider value={{ db, auth, currentUser, userId, showUserMessage }}>
            <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col items-center p-4">
                {/* Modal for user messages */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div ref={modalRef} className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                            <p className="text-lg font-semibold mb-4">{modalMessage}</p>
                            <button
                                onClick={closeModal}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-full hover:bg-indigo-700 transition-colors duration-200"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                )}

                {/* Header/Navbar */}
                <header className="w-full max-w-5xl bg-white rounded-lg shadow-md p-4 mb-6 flex justify-between items-center border border-gray-200">
                    <h1 className="text-3xl font-bold text-indigo-700 cursor-pointer" onClick={() => setCurrentPage('home')}>E-Shop</h1>
                    <nav className="flex items-center space-x-4">
                        <button onClick={() => setCurrentPage('home')} className="text-gray-700 hover:text-indigo-600 font-medium transition-colors duration-200">Products</button>
                        <button onClick={() => setCurrentPage('cart')} className="relative text-gray-700 hover:text-indigo-600 font-medium transition-colors duration-200">
                            Cart ({cartItems.length})
                            {cartItems.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                    {cartItems.length}
                                </span>
                            )}
                        </button>
                        {currentUser ? (
                            <>
                                <span className="text-sm text-gray-600">Hello, {currentUser.email || 'Guest'}!</span>
                                <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-full text-sm hover:bg-red-600 transition-colors duration-200 shadow-sm">Logout</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setCurrentPage('login')} className="bg-indigo-500 text-white px-4 py-2 rounded-full text-sm hover:bg-indigo-600 transition-colors duration-200 shadow-sm">Login</button>
                                <button onClick={() => setCurrentPage('register')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-full text-sm hover:bg-gray-300 transition-colors duration-200 shadow-sm">Register</button>
                            </>
                        )}
                    </nav>
                </header>

                <main className="w-full max-w-5xl bg-white rounded-lg shadow-lg p-6 border border-gray-200">
                    {renderPage()}
                </main>
            </div>
        </AppContext.Provider>
    );
}

// Product List Component
const ProductList = ({ products, addToCart, setCurrentPage, setSelectedProductId }) => {
    const { showUserMessage } = useContext(AppContext);
    const [showPermissionHint, setShowPermissionHint] = useState(false);

    useEffect(() => {
        // If products are still empty after a delay, suggest checking permissions
        const timer = setTimeout(() => {
            if (products.length === 0) {
                setShowPermissionHint(true);
            }
        }, 3000); // 3 seconds delay

        return () => clearTimeout(timer);
    }, [products]);


    return (
        <div>
            <h2 className="text-3xl font-bold text-indigo-600 mb-6 text-center">Our Products</h2>
            {products.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-gray-500 text-lg mb-4">No products available.</p>
                    {showPermissionHint && (
                        <p className="text-red-500 text-sm mt-2">
                            If products are not loading, please check your Firebase Firestore security rules.
                            Ensure read access is granted for the `products` collection.
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map(product => (
                        <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow duration-300">
                            <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-48 object-cover cursor-pointer"
                                onClick={() => { setSelectedProductId(product.id); setCurrentPage('productDetail'); }}
                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x200/cccccc/333333?text=No+Image`; }}
                            />
                            <div className="p-4">
                                <h3 className="text-xl font-semibold text-gray-900 mb-2 cursor-pointer" onClick={() => { setSelectedProductId(product.id); setCurrentPage('productDetail'); }}>{product.name}</h3>
                                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-2xl font-bold text-indigo-600">${product.price.toFixed(2)}</span>
                                    <button
                                        onClick={() => addToCart(product)}
                                        className="bg-indigo-600 text-white px-5 py-2 rounded-full hover:bg-indigo-700 transition-colors duration-200 shadow-md"
                                    >
                                        Add to Cart
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Product Detail Component
const ProductDetail = ({ product, addToCart, setCurrentPage }) => {
    const [quantity, setQuantity] = useState(1);
    const { showUserMessage } = useContext(AppContext);

    const handleAddToCart = () => {
        if (quantity <= 0) {
            showUserMessage("Quantity must be at least 1.");
            return;
        }
        addToCart(product, quantity);
    };

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200">
            <button onClick={() => setCurrentPage('home')} className="text-indigo-600 hover:underline mb-4 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                Back to Products
            </button>
            <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-1/2">
                    <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-auto rounded-lg shadow-md object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/400x300/cccccc/333333?text=No+Image`; }}
                    />
                </div>
                <div className="md:w-1/2">
                    <h2 className="text-4xl font-bold text-gray-900 mb-3">{product.name}</h2>
                    <p className="text-gray-700 text-lg mb-4">{product.description}</p>
                    <p className="text-indigo-600 text-5xl font-extrabold mb-6">${product.price.toFixed(2)}</p>
                    <div className="flex items-center mb-6">
                        <label htmlFor="quantity" className="mr-3 text-lg font-medium">Quantity:</label>
                        <input
                            type="number"
                            id="quantity"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 p-2 border border-gray-300 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <button
                        onClick={handleAddToCart}
                        className="w-full bg-indigo-600 text-white text-lg py-3 rounded-full hover:bg-indigo-700 transition-colors duration-200 shadow-lg font-semibold"
                    >
                        Add to Cart
                    </button>
                    <p className="text-sm text-gray-500 mt-4">In Stock: {product.stock}</p>
                </div>
            </div>
        </div>
    );
};

// Shopping Cart Component
const Cart = ({ cartItems, updateCartQuantity, removeFromCart, getCartTotal, setCurrentPage, userId }) => {
    const { showUserMessage } = useContext(AppContext);

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-indigo-600 mb-6 text-center">Your Shopping Cart</h2>
            {cartItems.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-gray-500 text-lg mb-4">Your cart is empty!</p>
                    <button onClick={() => setCurrentPage('home')} className="bg-indigo-500 text-white px-6 py-3 rounded-full hover:bg-indigo-600 transition-colors duration-200 shadow-md">
                        Start Shopping
                    </button>
                </div>
            ) : (
                <>
                    <div className="space-y-4 mb-6">
                        {cartItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
                                <div className="flex items-center">
                                    <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        className="w-20 h-20 object-cover rounded-md mr-4"
                                        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/80x80/cccccc/333333?text=No+Image`; }}
                                    />
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                                        <p className="text-gray-600">${item.price.toFixed(2)} each</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <button
                                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                        className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-300 transition-colors duration-200"
                                    >-</button>
                                    <span className="text-lg font-medium">{item.quantity}</span>
                                    <button
                                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                        className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-300 transition-colors duration-200"
                                    >+</button>
                                    <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="text-red-500 hover:text-red-700 transition-colors duration-200 ml-4"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="text-right text-2xl font-bold text-gray-900 mb-6 border-t pt-4 border-gray-200">
                        Total: ${getCartTotal()}
                    </div>
                    <div className="flex justify-between items-center">
                        <button onClick={() => setCurrentPage('home')} className="bg-gray-200 text-gray-800 px-6 py-3 rounded-full hover:bg-gray-300 transition-colors duration-200">
                            Continue Shopping
                        </button>
                        {userId ? (
                            <button onClick={() => setCurrentPage('checkout')} className="bg-indigo-600 text-white px-8 py-3 rounded-full hover:bg-indigo-700 transition-colors duration-200 shadow-lg font-semibold">
                                Proceed to Checkout
                            </button>
                        ) : (
                            <button onClick={() => { setCurrentPage('login'); showUserMessage("Please log in or register to proceed to checkout."); }} className="bg-indigo-600 text-white px-8 py-3 rounded-full hover:bg-indigo-700 transition-colors duration-200 shadow-lg font-semibold">
                                Login to Checkout
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// Checkout Component
const Checkout = ({ cartItems, getCartTotal, placeOrder, setCurrentPage }) => {
    const { userId, showUserMessage } = useContext(AppContext);

    if (!userId) {
        // This should ideally be handled by the parent component redirecting to login
        return <AuthForm type="login" onSubmit={() => {}} setCurrentPage={setCurrentPage} />;
    }

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-indigo-600 mb-6 text-center">Checkout</h2>
            <div className="mb-6">
                <h3 className="text-xl font-semibold mb-3">Order Summary</h3>
                <ul className="space-y-2">
                    {cartItems.map(item => (
                        <li key={item.id} className="flex justify-between items-center text-gray-700">
                            <span>{item.name} (x{item.quantity})</span>
                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                        </li>
                    ))}
                </ul>
                <div className="border-t border-gray-200 mt-4 pt-4 flex justify-between items-center text-xl font-bold text-gray-900">
                    <span>Total:</span>
                    <span>${getCartTotal()}</span>
                </div>
            </div>

            <div className="mb-6">
                <h3 className="text-xl font-semibold mb-3">Shipping Information</h3>
                {/* Placeholder for shipping form. In a real app, this would be a form. */}
                <div className="bg-gray-50 p-4 rounded-md text-gray-600">
                    <p>Shipping address would go here. (e.g., Name, Address, City, Zip)</p>
                    <p>Payment information would also be collected here.</p>
                </div>
            </div>

            <div className="flex justify-between">
                <button onClick={() => setCurrentPage('cart')} className="bg-gray-200 text-gray-800 px-6 py-3 rounded-full hover:bg-gray-300 transition-colors duration-200">
                    Back to Cart
                </button>
                <button
                    onClick={placeOrder}
                    className="bg-green-600 text-white px-8 py-3 rounded-full hover:bg-green-700 transition-colors duration-200 shadow-lg font-semibold"
                >
                    Confirm Order
                </button>
            </div>
        </div>
    );
};

// Auth Form Component (Login/Register)
const AuthForm = ({ type, onSubmit, setCurrentPage }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { showUserMessage } = useContext(AppContext);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!email || !password) {
            showUserMessage("Please enter both email and password.");
            return;
        }
        onSubmit(email, password);
    };

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-indigo-600 mb-6 text-center">{type === 'login' ? 'Login' : 'Register'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email:</label>
                    <input
                        type="email"
                        id="email"
                        className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-indigo-500"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Password:</label>
                    <input
                        type="password"
                        id="password"
                        className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-indigo-500"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white text-lg py-3 rounded-full hover:bg-indigo-700 transition-colors duration-200 shadow-lg font-semibold"
                >
                    {type === 'login' ? 'Login' : 'Register'}
                </button>
            </form>
            <div className="mt-6 text-center">
                {type === 'login' ? (
                    <p className="text-gray-600">Don't have an account? <button onClick={() => setCurrentPage('register')} className="text-indigo-600 hover:underline font-medium">Register here</button></p>
                ) : (
                    <p className="text-gray-600">Already have an account? <button onClick={() => setCurrentPage('login')} className="text-indigo-600 hover:underline font-medium">Login here</button></p>
                )}
            </div>
        </div>
    );
};

// Order Confirmation Component
const OrderConfirmation = ({ setCurrentPage }) => {
    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200 text-center">
            <h2 className="text-3xl font-bold text-green-600 mb-4">Order Confirmed!</h2>
            <p className="text-lg text-gray-700 mb-6">Thank you for your purchase. Your order has been successfully placed.</p>
            <svg className="w-24 h-24 text-green-500 mx-auto mb-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <button onClick={() => setCurrentPage('home')} className="bg-indigo-600 text-white px-6 py-3 rounded-full hover:bg-indigo-700 transition-colors duration-200 shadow-lg font-semibold">
                Continue Shopping
            </button>
        </div>
    );
};

export default App;
