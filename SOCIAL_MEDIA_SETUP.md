# Social Media Firebase Setup Guide

## Collection Structure

Create a Firestore collection called `socialMedia` with the following document structure:

```javascript
{
  platform: "instagram",           // Platform name (instagram, youtube, tiktok, spotify, twitter, facebook, soundcloud, apple)
  displayName: "Chase X Records", // Display name for the platform
  username: "chasexrecords",       // Username/handle without @
  handle: "@chasexrecords",        // Full handle with @ (optional)
  description: "Follow us on Instagram for behind-the-scenes content, studio updates, and artist spotlights.",
  profileUrl: "https://instagram.com/chasexrecords", // Direct link to profile
  followers: 12500,               // Current follower count
  followerCount: 12500,           // Alternative field name
  posts: 342,                     // Number of posts/content
  postCount: 342,                 // Alternative field name
  active: true,                   // Whether to show this platform
  featured: true,                 // Whether to feature this platform
  lastUpdated: timestamp,         // When this data was last updated
  verified: true,                 // Whether the account is verified
  contentType: "music",           // Type of content shared
  callToAction: "Follow us for exclusive content!" // Custom CTA text
}
```

## Sample Documents

### Instagram
```javascript
{
  platform: "instagram",
  displayName: "Chase X Records",
  username: "chasexrecords",
  description: "Follow us on Instagram for behind-the-scenes content, studio updates, and artist spotlights.",
  profileUrl: "https://instagram.com/chasexrecords",
  followers: 12500,
  posts: 342,
  active: true,
  featured: true,
  verified: false,
  contentType: "music",
  callToAction: "Follow us for exclusive studio content!"
}
```

### YouTube
```javascript
{
  platform: "youtube",
  displayName: "Chase X Records",
  username: "@chasexrecords",
  description: "Subscribe to our YouTube channel for music videos, tutorials, and exclusive performances.",
  profileUrl: "https://youtube.com/@chasexrecords",
  followers: 8900,
  posts: 156,
  active: true,
  featured: true,
  verified: false,
  contentType: "video",
  callToAction: "Subscribe for new music videos!"
}
```

### TikTok
```javascript
{
  platform: "tiktok",
  displayName: "Chase X Records",
  username: "@chasexrecords",
  description: "Join us on TikTok for short-form content, trending challenges, and studio vibes.",
  profileUrl: "https://tiktok.com/@chasexrecords",
  followers: 15600,
  posts: 89,
  active: true,
  featured: true,
  verified: false,
  contentType: "short-form",
  callToAction: "Follow for viral music content!"
}
```

### Spotify
```javascript
{
  platform: "spotify",
  displayName: "Chase X Records",
  username: "chasexrecords",
  description: "Listen to our latest releases and curated playlists on Spotify.",
  profileUrl: "https://open.spotify.com/artist/1gxLasEE8iDV3Coz8NosqX",
  followers: 5200,
  posts: 45,
  active: true,
  featured: false,
  verified: true,
  contentType: "music",
  callToAction: "Follow our artist profile!"
}
```

## Features

- **Dynamic Loading**: Social media data is fetched from Firebase in real-time
- **Fallback Content**: If no Firebase data exists, shows default social media links
- **Responsive Design**: Works on all screen sizes
- **Share Functionality**: Users can share social media profiles
- **Live Stats**: Shows total follower count and active platforms
- **Platform Icons**: Automatically styled icons for each platform
- **Hover Effects**: Interactive cards with smooth animations

## Security Rules

Add these security rules to your Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to social media collection for all users
    match /socialMedia/{documentId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

## Updating Data

To update social media data:

1. Go to Firebase Console
2. Navigate to Firestore Database
3. Select the `socialMedia` collection
4. Update the document fields (followers, posts, etc.)
5. The website will automatically reflect changes

## Customization

You can customize:
- Platform colors by editing the CSS classes
- Card layout by modifying the grid template
- Default content by updating `renderDefaultSocialCards()`
- Share functionality by modifying `shareSocialProfile()`
