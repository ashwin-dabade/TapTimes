# 🚀 News Typing App

A modern, real-time typing practice application that uses live news articles to help you improve your typing speed and accuracy. Type along with current news content from The Guardian and track your progress!

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)

## ✨ Features

- 📰 **Real News Content**: Practice typing with live articles from The Guardian
- ⚡ **Real-time Feedback**: See your accuracy and speed as you type
- 🎯 **Visual Highlighting**: Green for correct characters, red for mistakes
- ⏱️ **30-Second Timer**: Quick, focused typing sessions
- 📊 **Performance Metrics**: Track your WPM (Words Per Minute) and accuracy
- 🔄 **Fallback Mode**: Uses curated word lists when news API is unavailable
- 🌙 **Dark Mode Support**: Beautiful UI that adapts to your preference
- 📱 **Responsive Design**: Works perfectly on desktop and mobile

## 🎮 How It Works

1. **Start Typing**: The timer begins when you start typing
2. **Real-time Feedback**: Watch your characters turn green (correct) or red (incorrect)
3. **Track Progress**: Monitor your WPM and accuracy in real-time
4. **Get New Content**: Click "New Article" to fetch fresh news content
5. **View Results**: See your final score when the timer ends

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Guardian API key (optional, app works with fallback content)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ashwin-dabade/news-typing-app.git
   cd news-typing-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables** (optional)
   ```bash
   cp .env.example .env.local
   ```
   Add your Guardian API key to `.env.local`:
   ```
   GUARDIAN_API_KEY=your_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### Guardian API Setup (Optional)

To use real news articles:

1. Get a free API key from [The Guardian Open Platform](https://open-platform.theguardian.com/)
2. Add it to your `.env.local` file:
   ```
   GUARDIAN_API_KEY=your_api_key_here
   ```

**Note**: The app works perfectly without an API key using fallback content!

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API**: Guardian News API
- **Deployment**: Vercel-ready

## 📁 Project Structure

```
news-typing-app/
├── src/
│   ├── app/
│   │   ├── api/news/          # News API endpoint
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # App layout
│   │   └── page.tsx           # Main typing interface
│   └── lib/                   # Utility functions
├── .gitignore                 # Git ignore rules
├── package.json              # Dependencies
├── tailwind.config.js        # Tailwind configuration
└── tsconfig.json            # TypeScript configuration
```

## 🎯 Features in Detail

### Real-time Typing Analysis
- Character-by-character accuracy tracking
- Visual feedback with color-coded highlighting
- Live WPM calculation
- Real-time accuracy percentage

### News Integration
- Fetches fresh articles from The Guardian
- Cleans and processes HTML content
- Extracts meaningful text for typing practice
- Graceful fallback to curated word lists

### User Experience
- Responsive design for all screen sizes
- Keyboard-focused interface
- Smooth animations and transitions
- Accessible design patterns

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your `GUARDIAN_API_KEY` environment variable
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ashwin-dabade/news-typing-app)

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [The Guardian](https://www.theguardian.com/) for providing the news API
- [Next.js](https://nextjs.org/) for the amazing framework
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework

## 📞 Support

If you have any questions or run into issues, please open an issue on GitHub.

---

**Happy Typing! 🎯**
