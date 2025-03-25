// Learn more at developers.reddit.com/docs
import { Devvit, useState } from '@devvit/public-api';

Devvit.configure({
  http: true,
  redditAPI: true,
  redis: true,
  media: true,
});

// Add a menu item to the subreddit menu for instantiating the new experience post
Devvit.addMenuItem({
  label: 'mash-it!',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    ui.showToast("Submitting your post - upon completion you'll navigate there.");

    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitPost({
      title: 'My devvit post',
      subredditName: subreddit.name,
      // The preview appears while the post loads
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">Loading ...</text>
        </vstack>
      ),
    });
    ui.navigateTo(post);
  },
});

// Add a post type definition
Devvit.addCustomPostType({
  name: 'mash-it!',
  description: 'an subreddit post game for subreddit name fusion',
  height: 'regular',
  render: (_context) => {
    const [counter, setCounter] = useState(0);

    return (
      <vstack height="100%" width="100%" gap="medium" alignment="center middle">
        <image
          url="logo.png"
          description="logo"
          imageHeight={256}
          imageWidth={256}
          height="48px"
          width="48px"
        />
        <text size="large">{`Click counter: ${counter}`}</text>
        <button appearance="primary" onPress={() => setCounter((counter) => counter + 1)}>
          Click me!
        </button>
      </vstack>
    );
  },
});

export default Devvit;
