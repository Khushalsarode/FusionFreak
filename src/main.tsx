import { Devvit, useState, useAsync, useInterval, useForm, useChannel } from '@devvit/public-api';

import { getRandomSubreddits } from './subreddits.js';
Devvit.configure({
  http: true,
  redditAPI: true,
  redis: true,
  media: true,
  realtime: true,
});


// Function to create a new game post
async function createNewGamePost(context: Devvit.Context) {
    const { reddit } = context;
    const subreddit = await reddit.getCurrentSubreddit();
    const [subreddit1, subreddit2] = getRandomSubreddits(2);
    
    // Store the selected subreddits in Redis for this round
    const roundId = Date.now().toString();
    await context.redis.set(`round_${roundId}_subreddits`, JSON.stringify([subreddit1, subreddit2]));
    
    // Create the new game post
    const post = await reddit.submitPost({
      title: `🚀🌟 FusionFreak Challenge : ${roundId}`,
      subredditName: subreddit.name,
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <image
            url="loading.gif"
            description="logo"
            imageHeight={500}
            imageWidth={500}
            height="48px"
            width="48px"
          />
          <text>Loading your FusionFreak challenge...</text>
        </vstack>
      ),
    });
    
    // Store the post ID for this round
    await context.redis.set(`round_${roundId}_postId`, post.id);
    
    // Also store the mapping from post ID to round ID
    await context.redis.hSet('rounds', { [`round_${roundId}`]: post.id });
    
    return post;
  }

  // 1. Define a scheduler job that will create the game post
Devvit.addSchedulerJob({
  name: 'create_submash_challenge',
  onRun: async (event, context) => {
    try {
      // Call your existing function to create a new game post
      const post = await createNewGamePost(context as Devvit.Context);
      console.log(`Successfully created scheduled FusionFreak challenge: ${post.id}`);
    } catch (error) {
      console.error("Error creating scheduled FusionFreak challenge:", error);
    }
  },
});

Devvit.addTrigger({
  event: 'AppUpgrade',
  onEvent: async (_, context) => {
    try {
      // Same code as in AppInstall
      const existingJobId = await context.redis.get('submash_scheduler_job_id');
      if (existingJobId) {
        await context.scheduler.cancelJob(existingJobId);
        console.log(`Cancelled existing job with ID: ${existingJobId}`);
      }
      
      const jobId = await context.scheduler.runJob({
        name: 'create_submash_challenge',
        cron: '59 23 * * *', 
      });
      
      await context.redis.set('submash_scheduler_job_id', jobId);
      console.log(`Scheduled FusionFreak challenge creation with job ID: ${jobId}`);
    } catch (e) {
      console.error("Error setting up FusionFreak challenge scheduler:", e);
    }
  },
});


    
   // Create the form first
const scheduleManagementForm = Devvit.createForm(
  {
    title: "Manage FusionFreak Challenge Schedule",
    fields: [
      {
        name: "schedule_action",
        label: "Action",
        type: "select",
        options: [
          { label: "Create new schedule", value: "create" },
          { label: "Cancel current schedule", value: "cancel" }
        ]
      },
      {
        name: "cron",
        label: "Schedule (cron format, e.g. '59 23 * * *' for Each 24 hours)",
        type: "string",
        defaultValue: "59 23 * * *"
      }
    ],
    acceptLabel: "Submit",
  },
  // Form handler
  async (event, context) => {
    const { redis, scheduler, ui } = context;
    const values = event.values;
    
    if (Array.isArray(values.schedule_action) ? values.schedule_action[0] === "cancel" : values.schedule_action === "cancel") {
      const jobId = await redis.get('submash_scheduler_job_id');
      if (jobId) {
        await scheduler.cancelJob(jobId);
        await redis.del('submash_scheduler_job_id');
        ui.showToast("FusionFreak challenge schedule cancelled");
      } else {
        ui.showToast("No active schedule found");
      }
    } else {
      // Cancel any existing job first
      const existingJobId = await redis.get('submash_scheduler_job_id');
      if (existingJobId) {
        await scheduler.cancelJob(existingJobId);
      }
      
      // Create new schedule
      const newJobId = await scheduler.runJob({
        name: 'create_submash_challenge',
        cron: values.cron,
      });
      
      await redis.set('submash_scheduler_job_id', newJobId);
      ui.showToast(`New FusionFreak challenge schedule created`);
    }
  }
);

// First menu item for managing the schedule
Devvit.addMenuItem({
  label: 'Create FusionFreak Game Schedule',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { ui } = context;
    ui.showToast("Creating a new FusionFreak challenge schedule...");
    context.ui.showForm(scheduleManagementForm);
  }
});

// Second menu item for creating a new challenge
Devvit.addMenuItem({
  label: 'Create FusionFreak Challenge',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { ui } = context;
    ui.showToast("Creating a new FusionFreak challenge...");
    
    const post = await createNewGamePost(context);
    ui.navigateTo(post);
  }
});

Devvit.addMenuItem({
  label: 'Debug Scheduler',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { ui } = context;
    const jobId = await context.redis.get('submash_scheduler_job_id');
    ui.showToast(`Current job ID: ${jobId || 'None'}`);
    
    // Cancel the job if it exists
    if (jobId) {
      await context.scheduler.cancelJob(jobId);
      await context.redis.del('submash_scheduler_job_id');
      ui.showToast("Cancelled existing job");
    }
  }
});

// Add a post type definition for the game UI
Devvit.addCustomPostType({
    name: 'FusionFreak Challenge',
    description: 'A subreddit name fusion game',
    height: "tall",
    render: (context) => {
      // State variables
      const [userIdea, setUserIdea] = useState('');
      const [subreddit1, setSubreddit1] = useState({ name: '', emoji: '🔄' });
const [subreddit2, setSubreddit2] = useState({ name: '', emoji: '🔄' });
      const [submissions, setSubmissions] = useState<{ id: string; idea: string; author: string; votes: number; timestamp: string; score: number; }[]>([]);
      const [winningSubmission, setWinningSubmission] = useState<{
        id: string;
        idea: string;
        author: string;
        votes: number;
        timestamp: string;
        score: number;
      } | null>(null);
      
      const [aiDescription, setAiDescription] = useState('');
      const [currentPage, setCurrentPage] = useState(0);
      const [gameStarted, setGameStarted] = useState(false);
      // Add these state variables at the top of your component
      const [currentScreen, setCurrentScreen] = useState('main'); // 'main', 'winner', 'submissions'
      const [leaderboardData, setLeaderboardData] = useState<{ username: string; score: number }[]>([]); // Initialize leaderboard data
      const [showInstructions, setShowInstructions] = useState(false);
      const [showMainLeaderboard, setShowMainLeaderboard] = useState(false);

      const itemsPerPage = 2;
        // Calculate pagination values
  const totalPages = Math.ceil(submissions.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, submissions.length);
  const currentItems = submissions.slice(startIndex, endIndex);
  
  // Navigation handlers
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };
            // Inside your render function:
const [endTime, setEndTime] = useState(async () => {
  const postId = context.postId;
  const endTimeKey = `endTime_${postId}`;
  
  // Try to get existing end time from Redis
  const storedEndTime = await context.redis.get(endTimeKey);
  
  if (storedEndTime) {
    // Use the stored end time if it exists
    return storedEndTime;
  } else {
    // Create a new end time and store it in Redis
    const now = new Date();
    const newEndTime = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    await context.redis.set(endTimeKey, newEndTime);
    return newEndTime;
  }
});

const calculateTimeRemaining = () => {
  const now = new Date();
  const diff = new Date(endTime).getTime() - now.getTime();
  
  if (diff <= 0) return "00:00:00";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Initialize the timer display
const [timeRemaining, setTimeRemaining] = useState(() => calculateTimeRemaining());
const [gameEnded, setGameEnded] = useState(false);

// Create and start the timer interval
const updateInterval = useInterval(() => {
  const newTimeRemaining = calculateTimeRemaining();
  setTimeRemaining(newTimeRemaining);
  
  // Check if timer has reached zero
  if (newTimeRemaining === "00:00:00" && !gameEnded) {
    setGameEnded(true);
    updateInterval.stop(); // Stop the interval to prevent multiple calls
    endCurrentGame();
  }
}, 1000);

// Start the timer
updateInterval.start();

// Function to handle game ending
const endCurrentGame = async () => {
  // Check if this game has already been processed
  const alreadyEnded = await context.redis.get(`game_ended_${context.postId}`);
  if (alreadyEnded) {
    console.log(`Game ${context.postId} already ended, skipping duplicate processing`);
    return;
  }
  
  // Use Redis transactions to ensure only one process handles the game end
  const txn = await context.redis.watch(`game_ended_${context.postId}`);
  await txn.multi();
  await txn.set(`game_ended_${context.postId}`, "true");
  const success = await txn.exec();
  
  if (!success) {
    console.log("Another process is already handling game end");
    return;
  }
  
  // 1. Save game results to Redis
  await context.redis.set(`game_results_${context.postId}`, JSON.stringify({
    endTime: new Date().toISOString(),
    winningSubmission: winningSubmission ? {
      idea: winningSubmission.idea,
      author: winningSubmission.author,
      votes: winningSubmission.votes,
      score: winningSubmission.score
    } : null,
    subreddits: {
      subreddit1: subreddit1,
      subreddit2: subreddit2
    }
  }));
  
  // 2. Create a post for the ended game
  try {
    // Use Reddit API to create a new post
    const newPostResponse = await context.reddit.submitPost({
      subredditName: context.subredditName ?? 'defaultSubreddit',
      title: `Game Results - ${new Date().toLocaleString()}`,
      text: `The game has ended! Final results: Thank you for playing! \n
      Game Over! Check the results. \n Submissions are now closed. \n Schedule New Fusion Game! \n
      - Fusion Subreddits: ${subreddit1.emoji} r/${subreddit1.name} + ${subreddit2.emoji} r/${subreddit2.name} \n
      - 🥇Winning Idea: ${winningSubmission?.idea.toLocaleUpperCase() || ''} \n
      - 🔼 Votes: ${winningSubmission?.votes ?? 0} \n
      - 🥑 Submitted by: u/${winningSubmission?.author || 'Unknown'} \n
      - 🔥 score: ${winningSubmission?.score ?? 0}`,
    });
    
    // 3. Start a new game
    const newGamePostId = newPostResponse.id;
    
    // Set up the new game with a new end time
    const now = new Date();
    const newEndTime = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    await context.redis.set(`endTime_${newGamePostId}`, newEndTime);
    
    // Notify all clients about the new game
    context.realtime.send('new_game_started', { 
      newGamePostId,
      newEndTime
    });
    
    console.log(`Successfully created new game with ID: ${newGamePostId}`);
  } catch (error) {
    console.error("Error creating new game:", error);
    // If there was an error, remove the game_ended flag so another attempt can be made
    await context.redis.del(`game_ended_${context.postId}`);
  }
};

// Add a channel subscription to handle game end events from other clients
const channel = useChannel({
  name: 'game_channel',
  onMessage: (message: { type: string; postId: string }) => {
    if (message && message.type === 'game_ended' && message.postId === context.postId) {
      setGameEnded(true);
      updateInterval.stop();
    }
  }
});

channel.subscribe();            
      // Inside your render function, add this form definition:
      const ideaSubmissionForm = useForm(
        {
          fields: [
            {
              type: 'string',
              name: 'idea',
              label: 'Your creative subreddit Fusion...',
              color: 'red',
              multiline: true,
              required: true,
              helpText: `Include both "${subreddit1.name}" and "${subreddit2.name}" in your Fusion (max 10 words)`,
              onValidate: ({ value }: { value: string }) => {
                // Check word count (max 50 words)
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount > 10) {
                  return 'Your Fusion must be 10 words or less';
                }
                
                // Check if both subreddit names are included
                const lowerCaseValue = value.toLowerCase();
                const sub1Included = lowerCaseValue.includes(subreddit1.name.toLowerCase());
                const sub2Included = lowerCaseValue.includes(subreddit2.name.toLowerCase());
                
                if (!sub1Included || !sub2Included) {
                 return `Your Fusion must include both "${subreddit1.name}" and "${subreddit2.name}"`;
                }
              }
            },
          ],
          acceptLabel: 'Submit',
          cancelLabel: 'Cancel',
        },
      
        async (values) => {
          if (!values.idea.trim()) return;
    
          // Double-check validation criteria
          const wordCount = values.idea.trim().split(/\s+/).length;
          const lowerCaseValue = values.idea.toLowerCase();
          const sub1Included = lowerCaseValue.includes(subreddit1.name.toLowerCase());
          const sub2Included = lowerCaseValue.includes(subreddit2.name.toLowerCase());
          
          if (wordCount > 10 || !sub1Included || !sub2Included) {
              context.ui.showToast({
                  appearance: 'neutral',
                  text:'❌Fusion Rejection! Your Fusion must be 50 words or less'
              });
              return;
          }
          
          try {
            // Get just the username instead of the full user object for better performance
            const username = await context.reddit.getCurrentUsername();
            // Check if user has already submitted an idea for this post
            const postId = context.postId;
            const submissionsKey = `submissions_${postId}`;
            
            // Get existing submissions
            const submissionsJson = await context.redis.get(submissionsKey);
            let existingSubmissions = [];
            
            if (submissionsJson) {
              try {
                existingSubmissions = JSON.parse(submissionsJson);
                
                // Check if user already has a submission
                const userHasSubmission = existingSubmissions.some(
                  (submission: { id: string; idea: string; author: string; votes: number; timestamp: string; score: number;}) => submission.author === username
                );
                
                if (userHasSubmission) {
                  context.ui.showToast({
                    appearance: 'neutral',
                    text: '⚠️ You have already submitted a Fusion for this round!'
                  });
                  return;
                }
              } catch (e) {
                console.error("Error parsing submissions:", e);
              }
            }
            
            const newSubmission = {
              id: Date.now().toString(),
              idea: values.idea,
              author: username || 'Unknown',
              votes: 0,
              timestamp: new Date().toISOString(),
              score: 10
            };
            
            // Use Redis transaction to ensure data consistency
            const txn = await context.redis.watch(submissionsKey);
            await txn.multi();
            
            const updatedSubmissions = [...existingSubmissions, newSubmission];
            await txn.set(submissionsKey, JSON.stringify(updatedSubmissions));
            await txn.exec();
            
            // Update local state
            setSubmissions(updatedSubmissions);
            
            // Update winning idea if this is the first submission or has more votes
            if (existingSubmissions.length === 0 || newSubmission.votes > existingSubmissions[0].votes) {
              setWinningSubmission(newSubmission);
            }
            
            context.ui.showToast({
                appearance:'success',
                text:'✔ Your Fusion has been submitted!'
            });
          } catch (error) {
            console.error("Error submitting idea:", error);
            context.ui.showToast('Failed to submit your fusion. Please try again.');
          }
        }
      );

  useAsync(async () => {
    try {
      const postId = context.postId;
      const subredditPairKey = `subreddit_pair_${postId}`;
      
      // First check if we already have stored subreddits for this post
      let subredditsJson = await context.redis.get(subredditPairKey);
      
      if (!subredditsJson) {
        // If no subreddits are stored for this post yet, find them or generate random ones
        const keys = await context.redis.hKeys('rounds');
        
        let subreddits = null;
        for (const key of keys) {
          const storedPostId = await context.redis.get(`rounds:${key}`);
          if (storedPostId === postId) {
            const roundId = key.split('_')[1];
            subredditsJson = await context.redis.get(`round_${roundId}_subreddits`);
            
            if (subredditsJson) {
              subreddits = JSON.parse(subredditsJson);
              if (subreddits && subreddits.length >= 2) {
                // Store these subreddits permanently for this post
                await context.redis.set(subredditPairKey, subredditsJson);
                // No expiration set, so it will remain forever
                break;
              }
            }
          }
        }
        
        // If no subreddits found in rounds, use random ones and store them
        if (!subreddits) {
          subreddits = getRandomSubreddits(2);
          await context.redis.set(subredditPairKey, JSON.stringify(subreddits));
        }
        
        return subreddits;
      } else {
        // Return the permanently stored subreddits
        return JSON.parse(subredditsJson);
      }
    } catch (error) {
      console.error("Error loading subreddits:", error);
      return getRandomSubreddits(2);
    }
  }, {
    finally: (data, error) => {
      // Your existing processing code remains the same
      if (!error && data) {
        if (Array.isArray(data) && data.length >= 2) {
          // Process each subreddit string to extract name and emoji
          const processSubreddit = (sub: string | { name: string; emoji?: string }) => {
            if (typeof sub === 'string') {
              const emojiMatch = sub.match(/[\p{Emoji}\u200d]+$/u);
              const emoji = emojiMatch ? emojiMatch[0] : '📋';
              const name = sub.replace(emojiMatch ? emojiMatch[0] : '', '');
              return { name, emoji };
            } else if (sub && typeof sub === 'object' && 'name' in sub && 'emoji' in sub) {
              return sub;
            }
            return { name: String(sub), emoji: '📋' };
          };
          
          setSubreddit1({ ...processSubreddit(data[0]), emoji: processSubreddit(data[0]).emoji || '📋' });
          setSubreddit2({ ...processSubreddit(data[1]), emoji: processSubreddit(data[1]).emoji || '📋' });
        }
      } else {
        const [s1, s2] = getRandomSubreddits(2);
        setSubreddit1(s1);
        setSubreddit2(s2);
      }
    }
  });

      
  
      // Vote on an idea
const handleVote = async (id: string) => {
  try {
    const postId = context.postId;
    const submissionsKey = `submissions_${postId}`;
    const username = context.userId || 'anonymous'; // Get current user
    const userVotesKey = `user_votes_${postId}_${username}`; // Key to track user votes
    
    // Check if user has already voted on this idea
    const userVotesJson = await context.redis.get(userVotesKey);
    let userVotes: string[] = userVotesJson ? JSON.parse(userVotesJson) : [];
    
    if (userVotes.includes(id)) {
      context.ui.showToast('You have already voted on this idea!');
      return;
    }
    
    // Use Redis transaction to ensure data consistency
    const txn = await context.redis.watch(submissionsKey);
    await txn.multi();
    
    // Get current submissions
    const submissionsJson = await context.redis.get(submissionsKey);
    
    // Define the type for submissions
    type Submission = {
      id: string;
      idea: string;
      author: string;
      votes: number;
      timestamp: string;
      score: number;
    };
    
    let existingSubmissions: Submission[] = [];
    
    if (submissionsJson) {
      try {
        existingSubmissions = JSON.parse(submissionsJson);
      } catch (e) {
        console.error("Error parsing submissions:", e);
      }
    }
    
    // Update the submission with the new vote
    const updatedSubmissions = existingSubmissions.map((sub: Submission) => 
      sub.id === id ? {...sub, votes: (sub.votes || 0) + 1, score: (sub.score || 0) + 10} : sub
    );
    
    // Save updated submissions
    await txn.set(submissionsKey, JSON.stringify(updatedSubmissions));
    
    // Add this idea to user's voted list
    userVotes.push(id);
    await txn.set(userVotesKey, JSON.stringify(userVotes));
    
    // Execute the transaction
    const success = await txn.exec();
    
    if (!success) {
      context.ui.showToast('Error recording vote. Please try again.');
      return;
    }
    
    // Update local state
    setSubmissions(updatedSubmissions);
    
    // Update the winning idea
    const topSubmission = [...updatedSubmissions].sort((a, b) => b.votes - a.votes)[0];
    if (topSubmission) {
      setWinningSubmission(topSubmission);
    }
    
    // Find the submission that was voted on to show the author in the toast
    const votedSubmission = updatedSubmissions.find(sub => sub.id === id);
    context.ui.showToast(`Vote recorded! +10 points to ${votedSubmission?.author || 'user'}`);
  } catch (error) {
    console.error("Error voting:", error);
    context.ui.showToast('Failed to record your vote. Please try again.');
  }
};
      
      // Use useAsync to load submissions
        useAsync(async () => {
            try {
            const postId = context.postId;
            const submissionsKey = `submissions_${postId}`;
            const submissionsJson = await context.redis.get(submissionsKey);
            
            if (submissionsJson) {
                const existingSubmissions = JSON.parse(submissionsJson);
                return existingSubmissions;
            }
            return [];
            } catch (error) {
            console.error("Error loading submissions:", error);
            return [];
            }
        }, {
            finally: (data) => {
            if (data && data.length > 0) {
                setSubmissions(data);
                
                // Set the winning idea if there are submissions
                const topSubmission = [...data].sort((a, b) => b.votes - a.votes)[0];
                if (topSubmission) {
                  setWinningSubmission(topSubmission);
                }

            }
            }
        });
          // Transform submissions into leaderboard data
          const transformedLeaderboardData = submissions
          .map(submission => ({
            username: submission.author,
            score: submission.score,
            idea: submission.idea
          }))
          .sort((a, b) => b.score - a.score); // Sort by score in descending order
          
        // Use the useAsync hook to fetch data
        const { data: topSubmissions, loading, error } = useAsync(async () => {
          return await context.redis.zRange('leaderboard', 0, 2, {
            reverse: true,  // To get highest scores first
            by: 'rank',
          });
        });

        // Destructure the results for easy access (only if data is available)
        const firstPlace = topSubmissions?.[0];
        const secondPlace = topSubmissions?.[1];
        const thirdPlace = topSubmissions?.[2];

return (
  <blocks height="tall">
    {!gameStarted ? (
      // Main Screen with Play Button
      <vstack width="100%" height="100%" alignment="center middle" gap="small" padding="medium">
      {showInstructions ? (
        // Instructions Screen
        <vstack width="100%" gap="medium" padding="medium" border="thin" cornerRadius="medium" backgroundColor="#3d3d3d">
            <vstack gap="small" alignment="center" padding="small" backgroundColor="#1A1A1B" cornerRadius="medium" border="thin">
              <text size="xlarge" weight="bold" alignment="center" color="#FF4500">🎮 FusionFreak Challenge</text>
              
              <vstack gap="small" alignment="center" width="100%">
                <hstack gap="small" alignment="center">
                  <text size="xlarge">🔀</text>
                  <vstack alignment="start" grow>
                    <text size="medium" weight="bold">1. Create Your Fusion</text>
                    <text size="small">Blend two subreddits into one brilliant idea! Think r/esports + r/leagueoflegends.</text>
                    <text size='small'>"Pro teams battle fiercely in Worlds, chasing ultimate esports glory!"</text>
                    <text size='small'>"Faker dominates Worlds, esports fans cheer, League of Legends thrives!"</text>
                  </vstack>
                </hstack>
                
                <hstack gap="small" alignment="center">
                  <text size="xlarge">⬆️</text>
                  <vstack alignment="start" grow>
                    <text size="medium" weight="bold">2. Vote for the Best</text>
                    <text size="small">Browse the creative Fusions and upvote your favorites. </text>
                    <text size='small'>The community decides what rises to the top!</text>
                  </vstack>
                </hstack>
                
                <hstack gap="small" alignment="center">
                  <text size="xlarge">🏆</text>
                  <vstack alignment="start" grow>
                    <text size="medium" weight="bold">3. Claim Victory</text>
                    <text size="small">The submission with the most votes wins the round and earns points!</text>
                  </vstack>
                </hstack>
                
                <vstack gap="small" alignment="start" border="thin" cornerRadius="medium" padding="small" backgroundColor="#2D2D2E" width="100%">
                  <text weight="bold" size="medium" alignment="center" width="100%">📋 The Rules</text>
                  <text size="small" alignment='middle'>• 🔤 Your fusion MUST include both subreddit names</text>
                  <text size="small" alignment='middle'>• 📝 Keep it under 10 words (brevity is the soul of wit!)</text>
                  <text size="small" alignment='middle'>• 👤 One submission per user per round</text>
                  <text size="small" alignment='middle'>• 🎭 Be creative, funny, and keep it community-friendly</text>
                  <text size="small" alignment='middle'>• 🔄 New rounds start daily with fresh subreddit pairs</text>
                </vstack>
              </vstack>
            </vstack>
            
            <button
              appearance="primary"
              size="medium"
              onPress={() => setShowInstructions(false)}
            >
              Got it!
            </button>
          </vstack>

        ) 
        
        : (
          // Main Menu
          <vstack width="100%" height="100%" alignment="center middle" gap="medium">
            <image
              url="name.png"
              description="logo"
              imageHeight={256}
              imageWidth={256}
              height="100px"
              width="100px"
            />
            <text size="xxlarge" weight="bold">FusionFreak Challenge</text>
            <text>Where subreddit worlds collide in creative chaos!</text>
            <spacer size="medium" />
            <vstack width="100%" gap="small" alignment="center" padding="small" >
            <button
              appearance="primary"
              size="large"
              width='100%'
              onPress={() => setGameStarted(true)}
            >
              ▶ Play Game
            </button>
            <button
              appearance="secondary"
              width='100%'
              onPress={() => setShowInstructions(true)}
            >
              ❓ How to Play
            </button>
            </vstack>
          </vstack>
        )}
      </vstack>
    ) : currentScreen === 'winner' ? (
      // Winner Details Screen
      <vstack width="100%" gap="medium" padding="small">
        {/* Header with back button */}
        <hstack alignment="center middle" gap="small">
          <button 
            appearance="plain" 
            icon="back"
            onPress={() => setCurrentScreen('main')}
          />
          <text size="xlarge" weight="bold">Top Idea Details</text>
        </hstack>
        
        {/* Expanded Winner Content */}
        <vstack gap="medium" border="thin" cornerRadius="medium" padding="medium" backgroundColor="#3d3d3d">
          <text size="xlarge" weight="bold">🏆 Current Top Idea:</text>
          {winningSubmission && (
            <vstack width="100%" padding="small">
              <text size="large" alignment="center" width="100%">
                {winningSubmission.idea.toLocaleUpperCase()}
              </text>
            </vstack>
          )}
                  
          {aiDescription && (
            <vstack gap="medium">
              <text size="large" weight="bold">🤖 AI Description:</text>
              <text>{aiDescription}</text>
            </vstack>
          )}
          
          {/* Additional details you might want to show */}
          <text>Votes: ⬆️ {winningSubmission?.votes ?? 0}</text>
          <text>Submitted by: u/${winningSubmission?.author || 'Unknown'}</text>
          {winningSubmission && <text>🔥 score: {winningSubmission.score}</text>}
          
          <button
            appearance="primary"
            onPress={() => setCurrentScreen('main')}
          >
            Back to Game
          </button>
        </vstack>
      </vstack>
    ) : currentScreen === 'submissions' ? (
      // Submissions List Screen
      <vstack width="100%" gap="medium" padding="small">
        {/* Header with back button */}
        <hstack alignment="center middle" gap="small">
          <button 
            appearance="plain" 
            icon="back"
            onPress={() => setCurrentScreen('main')}
          />
          <text size="xlarge" weight="bold">All Submissions</text>
        </hstack>
        
        {/* Full Submissions List */}
        <vstack gap="small" border="thin" cornerRadius="medium" padding="small">
          {/* Pagination controls */}
          {totalPages > 1 && (
            <hstack padding="small" alignment="center middle" gap="small">
              <button 
                appearance="plain"
                size='small'
                onPress={goToPrevPage}
                disabled={currentPage === 0}
              >
                ← Previous
              </button>
              
              <text size="small">
                Page {currentPage + 1} of {totalPages}
              </text>
              
              <button 
              size='small'
                appearance="plain"
                onPress={goToNextPage}
                disabled={currentPage === totalPages - 1}
              >
                Next →
              </button>
            </hstack>
          )}
          
          <text weight="bold" size="large">📝 All Fusion Submissions:</text>
          
          {submissions.length === 0 ? (
            <text>No submissions yet. Be the first to submit a Fusion!</text>
          ) : (
            <vstack gap="small">
              {currentItems.map(sub => (
                <vstack key={sub.id} gap="small" border="thin" cornerRadius="medium" padding="small">
                  <text size="large">{sub.idea}</text>
                  <hstack alignment="start" gap="small">
                    <text size="small" color="green">by u/{sub.author}</text>
                    <text>⬆️ {sub.votes || 0} votes</text>
                    <text>🔥 score: {sub.score}</text>
                  </hstack>
                  <button
                    appearance="primary"
                    size="small"
                    onPress={() => handleVote(sub.id)}
                  >
                    Vote for this idea
                  </button>
                </vstack>
              ))}
            </vstack>
          )}
          
          <button
            appearance="primary"
            onPress={() => setCurrentScreen('main')}
          >
            Back to Game
          </button>
        </vstack>
      </vstack>
    ) : (
      // Main Game Screen
      <vstack width="100%" gap="medium" padding="small">
        {/* Header */}
        <hstack alignment="center middle" gap="small">
          <image
            url="logo.png"
            description="logo"
            imageHeight={256}
            imageWidth={256}
            height="36px"
            width="36px"
          />
          <text size="xlarge" weight="bold">FusionFreak Challenge</text>
        </hstack>
        
        {/* Challenge Info */}
        <vstack 
          border="thin" 
          cornerRadius="medium" 
          padding="small" 
          backgroundColor="#2b54a6"
        >
          <text size="large" weight="bold" alignment='center middle'>🔥 Today's Subreddit FusionFreak Challenge!</text>
          <text alignment='center middle'>{subreddit1.emoji} r/{subreddit1.name} + {subreddit2.emoji} r/{subreddit2.name}</text>
          <text size="small" alignment='end top' color='red'>Time remaining: {timeRemaining}</text>
        </vstack>
        
        {/* Submission Form */}
        <vstack gap="small" border="thin" cornerRadius="medium" padding="medium">
          <text weight="bold">💡 Submit Your FusionFreak Idea:</text>
          <button
            appearance="primary"
            onPress={() => context.ui.showForm(ideaSubmissionForm)}
          >
            Submit an Idea
          </button>
        </vstack>
        
        {/* Current Winner - Now clickable */}
        {winningSubmission && (
          <vstack 
            gap="small" 
            border="thin" 
            cornerRadius="medium" 
            padding="small" 
            backgroundColor="#304775"
            onPress={() => setCurrentScreen('winner')}
          >
            <vstack alignment="center" gap="small">
              <text weight="bold">🏆 Current Top Idea</text>
              <text>{winningSubmission.idea}</text>
              <button 
                appearance="primary" 
                size="small"
                onPress={() => setCurrentScreen('winner')}
              >
                Check it out!
              </button>
            </vstack>
          </vstack>
        )}
        
        {/* Submissions List Preview - Now clickable */}
        <vstack 
          gap="small" 
          border="thin" 
          cornerRadius="medium" 
          padding="small"
        >
          <hstack alignment="center middle">
            <text weight="bold">📝 Recent Submissions:</text>
            <button 
              appearance="plain" 
              onPress={() => setCurrentScreen('submissions')}
            >
              View All
            </button>
          </hstack>
          
          {submissions.length === 0 ? (
            <text>Be the first to submit a Fusion!</text>
          ) : (
            <text></text>
          )}
         
        </vstack>
         {/* Add this button to go back to the play button screen */}
         <button
            appearance="secondary"
            onPress={() => setGameStarted(false)}
          >
            Back to Main Menu
          </button>
      </vstack>
    )}
  </blocks>
);
    },

    
  });


  

  
  export default Devvit;