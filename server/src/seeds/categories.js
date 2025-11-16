const mongoose = require('mongoose');
const Category = require('../models/Category');
require('dotenv').config();

// Nepali service categories
const categories = [
  {
    name: 'Technology & Programming',
    description: 'Web development, mobile apps, software solutions, and tech services',
    icon: '💻',
    color: '#4C8BF5',
    sortOrder: 1
  },
  {
    name: 'Design & Creative',
    description: 'Graphic design, logo design, UI/UX, and creative services',
    icon: '🎨',
    color: '#FF6B6B',
    sortOrder: 2
  },
  {
    name: 'Writing & Translation',
    description: 'Content writing, copywriting, translation, and editorial services',
    icon: '✍️',
    color: '#4ECDC4',
    sortOrder: 3
  },
  {
    name: 'Digital Marketing',
    description: 'SEO, social media marketing, PPC, and digital advertising',
    icon: '📈',
    color: '#95E1D3',
    sortOrder: 4
  },
  {
    name: 'Video & Animation',
    description: 'Video editing, animation, motion graphics, and video production',
    icon: '🎬',
    color: '#F38630',
    sortOrder: 5
  },
  {
    name: 'Music & Audio',
    description: 'Music production, voice over, audio editing, and sound design',
    icon: '🎵',
    color: '#E056FD',
    sortOrder: 6
  },
  {
    name: 'Business & Finance',
    description: 'Business consulting, accounting, financial planning, and market research',
    icon: '💼',
    color: '#00CEC9',
    sortOrder: 7
  },
  {
    name: 'Education & Training',
    description: 'Online tutoring, course creation, training materials, and coaching',
    icon: '📚',
    color: '#6A0DAD',
    sortOrder: 8
  },
  {
    name: 'Home & Lifestyle',
    description: 'Home services, personal assistance, lifestyle consulting, and local tasks',
    icon: '🏠',
    color: '#FB8500',
    sortOrder: 9
  },
  {
    name: 'Health & Wellness',
    description: 'Health coaching, fitness training, nutrition advice, and wellness services',
    icon: '🏥�',
    color: '#2A9D8F',
    sortOrder: 10
  },
  {
    name: 'Photography',
    description: 'Product photography, event photography, photo editing, and image retouching',
    icon: '📷',
    color: '#FF006E',
    sortOrder: 11
  },
  {
    name: 'Support & Customer Service',
    description: 'Virtual assistance, customer support, data entry, and administrative tasks',
    icon: '🎧',
    color: '#8338EC',
    sortOrder: 12
  },
  {
    name: 'Events & Hospitality',
    description: 'Event planning, catering, decoration, and hospitality services',
    icon: '🎉',
    color: '#FFBE0B',
    sortOrder: 13
  },
  {
    name: 'Legal & Consulting',
    description: 'Legal advice, business consulting, contract review, and professional services',
    icon: '⚖️',
    color: '#3A86FF',
    sortOrder: 14
  },
  {
    name: 'Travel & Tourism',
    description: 'Travel planning, tour guiding, local experiences, and tourism services',
    icon: '✈️',
    color: '#FB5607',
    sortOrder: 15
  },
  {
    name: 'Handmade & Crafts',
    description: 'Custom crafts, handmade products, artisan services, and creative making',
    icon: '🔧',
    color: '#FF9A00',
    sortOrder: 16
  },
  {
    name: 'Food & Cooking',
    description: 'Meal preparation, recipe development, food photography, and cooking services',
    icon: '🍳',
    color: '#C77DFF',
    sortOrder: 17
  },
  {
    name: 'Transportation & Logistics',
    description: 'Delivery services, logistics coordination, transportation, and shipping',
    icon: '🚚',
    color: '#7209B7',
    sortOrder: 18
  },
  {
    name: 'Repairs & Maintenance',
    description: 'Home repairs, appliance maintenance, technical support, and fixing services',
    icon: '🔨',
    color: '#560BAD',
    sortOrder: 19
  },
  {
    name: 'Personal Care & Beauty',
    description: 'Beauty services, personal care, styling, and wellness treatments',
    icon: '💄',
    color: '#B5179E',
    sortOrder: 20
  }
];

// Seed categories
const seedCategories = async () => {
  try {
    console.log('Starting to seed categories...');

    // Clear existing categories
    await Category.deleteMany({});
    console.log('Cleared existing categories');

    // Insert new categories
    const insertedCategories = await Category.insertMany(categories);
    console.log(`Inserted ${insertedCategories.length} categories`);

    // Display inserted categories
    insertedCategories.forEach((category, index) => {
      console.log(`${index + 1}. ${category.name} - ${category.description}`);
    });

    console.log('Categories seeding completed successfully!');
    return insertedCategories;
  } catch (error) {
    console.error('Error seeding categories:', error);
    throw error;
  }
};

// Run seeder if called directly
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sahayog_db')
    .then(() => {
      console.log('Connected to MongoDB');
      return seedCategories();
    })
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedCategories;