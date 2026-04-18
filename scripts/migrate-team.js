// Migration script to add sample team members to Firebase
// Run this in the browser console or as a module

import { db } from './firebase-init.js';
import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const teamMembers = [
    {
        name: 'Chase x Bigoma',
        role: 'Founder & CEO',
        badge: 'Founder',
        bio: 'Visionary producer and founder of Chase x Records. Passionate about bringing East African music to the global stage.',
        skills: ['Production', 'A&R', 'Business Strategy'],
        status: 'active',
        image: 'https://via.placeholder.com/250',
        socials: {
            instagram: 'https://www.instagram.com/chase_x_/',
            twitter: 'https://x.com/chasexc',
            linkedin: 'https://linkedin.com'
        },
        createdAt: new Date().toISOString()
    },
    {
        name: 'Audio Engineer',
        role: 'Lead Audio Engineer',
        badge: 'Engineer',
        bio: 'Expert in mixing and mastering with over 10 years of experience in the music industry.',
        skills: ['Mixing', 'Mastering', 'Sound Design'],
        status: 'active',
        image: 'https://via.placeholder.com/250',
        socials: {
            instagram: 'https://instagram.com',
            twitter: 'https://x.com'
        },
        createdAt: new Date().toISOString()
    },
    {
        name: 'Music Producer',
        role: 'Senior Producer',
        badge: 'Producer',
        bio: 'Talented producer specializing in Afrobeat and East African music genres.',
        skills: ['Production', 'Beat Making', 'Arrangement'],
        status: 'active',
        image: 'https://via.placeholder.com/250',
        socials: {
            instagram: 'https://instagram.com',
            twitter: 'https://x.com'
        },
        createdAt: new Date().toISOString()
    },
    {
        name: 'Studio Manager',
        role: 'Studio Manager',
        badge: 'Manager',
        bio: 'Ensures smooth studio operations and artist relations.',
        skills: ['Management', 'Scheduling', 'Artist Relations'],
        status: 'active',
        image: 'https://via.placeholder.com/250',
        socials: {
            instagram: 'https://instagram.com',
            linkedin: 'https://linkedin.com'
        },
        createdAt: new Date().toISOString()
    }
];

async function migrateTeamMembers() {
    console.log('Starting team member migration...');
    
    try {
        for (const member of teamMembers) {
            console.log(`Adding team member: ${member.name}`);
            await addDoc(collection(db, 'team'), member);
            console.log(`✓ Successfully added: ${member.name}`);
        }
        
        console.log('✓ All team members migrated successfully!');
        console.log('You can now manage them in the admin panel Team section.');
    } catch (error) {
        console.error('Error migrating team members:', error);
    }
}

// Run the migration
migrateTeamMembers();
