const data = {
    items: [
        { 
            id: 1, 
            title: 'The Witcher 3', 
            categoryId: 1, 
            platformId: 1, 
            rating: 10, 
            salesMillions: 50, 
            releaseYear: 2015, 
            online: false, 
            tags: [
                'RPG', 
                'Open World', 
                'Story Rich'
            ] 
        },
        { 
            id: 2, 
            title: 'Counter-Strike 2', 
            categoryId: 2, 
            platformId: 1, 
            rating: 9, 
            salesMillions: 40, 
            releaseYear: 2023, 
            online: true, 
            tags: [
                'FPS', 
                'Tactical', 
                'Competitive'
            ] 
        },
        { 
            id: 3, 
            title: 'Elden Ring', 
            categoryId: 1, 
            platformId: 2, 
            rating: 10, 
            salesMillions: 25, 
            releaseYear: 2022, 
            online: true, 
            tags: [
                'RPG', 
                'Souls-like', 
                'Open World'
            ] 
        },
        { 
            id: 4, 
            title: 'FIFA 23', 
            categoryId: 3, 
            platformId: 2, 
            rating: 7, 
            salesMillions: 30, 
            releaseYear: 2022, 
            online: true, 
            tags: [
                'Sports', 
                'Football', 
                'Simulation'
            ] 
        },
        { 
            id: 5, 
            title: 'Cyberpunk 2077', 
            categoryId: 1, 
            platformId: 1, 
            rating: 8, 
            salesMillions: 20, 
            releaseYear: 2020, 
            online: false, 
            tags: [
                'RPG', 
                'Sci-Fi', 
                'Open World'
            ] 
        },
        { 
            id: 6, 
            title: 'Hades', 
            categoryId: 4, 
            platformId: 3, 
            rating: 9, 
            salesMillions: 6, 
            releaseYear: 2020, 
            online: false, 
            tags: [
                'Rogue-like', 
                'Indie', 
                'Action'
            ] 
        },
        { 
            id: 7, 
            title: 'Valorant', 
            categoryId: 2, 
            platformId: 1, 
            rating: 8, 
            salesMillions: 0, 
            releaseYear: 2020, 
            online: true, 
            tags: [
                'FPS', 
                'Hero Shooter', 
                'Competitive'
            ] 
        },
        { 
            id: 8, 
            title: 'Stardew Valley', 
            categoryId: 5, 
            platformId: 3, 
            rating: 10, 
            salesMillions: 30, 
            releaseYear: 2016, 
            online: true, 
            tags: [
                'Farming', 
                'Indie', 
                'Relaxing'
            ] 
        },
        { 
            id: 9, 
            title: 'League of Legends', 
            categoryId: 6, 
            platformId: 1, 
            rating: 8, 
            releaseYear: 2009, 
            salesMillions: 0, 
            online: true, 
            tags: [
                'MOBA', 
                'Strategy', 
                'Competitive'
            ] 
        },
        { 
            id: 10, 
            title: 'Street Fighter 6', 
            categoryId: 7, 
            platformId: 2, 
            rating: 9, 
            salesMillions: 3, 
            releaseYear: 2023, 
            online: true, 
            tags: [
                'Fighting', 
                'Arcade', 
                'Competitive'
            ] 
        }
    ],
    categories: [
        {id: 1, name: 'RPG'},
        {id: 2, name: 'Shooter'},
        {id: 3, name: 'Sports'},
        {id: 4, name: 'Action Rogue-like'},
        {id: 5, name: 'Simulation'},
        {id: 6, name: 'MOBA'},
        {id: 7, name: 'Fighting'}
    ],
    platforms: [
        {id: 1, name: 'PC Only'},
        {id: 2, name: 'Cross-Platform'},
        {id: 3, name: 'Console & PC (Indie Focus)'}
    ]
};

module.exports = data;