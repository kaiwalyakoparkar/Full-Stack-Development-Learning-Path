const M = require("minimatch");

movies = [
    {
        name: 'Godzilla',
        bannerImage: 'https://i.pinimg.com/originals/45/33/af/4533af5cc6100cb773cbd3f503f4e159.jpg', 
        price: 15,
        type: 'Movie',
        desc: 'This is the famous godzilla movie',
        cast: ['cast 1', 'cast 2', 'cast 3', 'cast 4'],
        slug: 'godzilla'
    },
    {
        name: 'Lucifer',
        bannerImage: 'https://i.redd.it/yae6uvqijdn41.jpg', 
        price: 15,
        type: 'Series',
        desc: 'This is the famous Lucifer series',
        cast: ['cast 1', 'cast 2', 'cast 3', 'cast 4'],
        slug: 'lucifer'
    },
    {
        name: 'Dr Strange',
        bannerImage: 'https://images-na.ssl-images-amazon.com/images/I/61yHlaxjkgL._AC_.jpg', 
        price: 15,
        type: 'Movie',
        desc: 'This is the famous Dr. Strange Movie',
        cast: ['cast 1', 'cast 2', 'cast 3', 'cast 4'],
        slug: 'dr-strange'
    },
    {
        name: 'Iron Man',
        bannerImage: 'https://lh3.googleusercontent.com/proxy/k38BZphPS2ATGQce2HSgRyhfOvMH75-MIr5n_Ta1cT_f78HxjH5Yf-nhNSdAqMF_9ztdGnMEHnTwlZGRn76_8lkgqqMyubix6ejKo5xSjw',
        price: 15,
        type: 'Movie',
        desc: 'This is the famous Iron man Movie',
        cast: ['cast 1', 'cast 2', 'cast 3', 'cast 4'],
        slug: 'ironman'
    }

]

module.exports = movies;