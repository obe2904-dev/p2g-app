import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { 
  Sparkles, 
  Upload, 
  Camera, 
  RefreshCw,
  Lightbulb,
  Target,
  Calendar,
  PenTool,
  Facebook,
  Instagram,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

export function ContentAssistant() {
  const [selectedPlatform, setSelectedPlatform] = useState<'facebook' | 'instagram' | ''>('');
  const [currentPost, setCurrentPost] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);

  const platformSuggestions = {
    facebook: [
      {
        type: 'Community Building',
        content: 'What\'s one thing you wish you knew when you started your journey? Share your wisdom in the comments below! 💭',
        engagement: 'High',
        bestTime: '1:00 PM'
      },
      {
        type: 'Behind the Scenes',
        content: 'Take a peek behind the curtain! Here\'s what a typical day looks like at our office...',
        engagement: 'Medium',
        bestTime: '3:00 PM'
      },
      {
        type: 'Educational',
        content: 'Did you know? [Share an interesting fact related to your industry] - What other facts would you like to learn about?',
        engagement: 'High',
        bestTime: '11:00 AM'
      }
    ],
    instagram: [
      {
        type: 'Visual Story',
        content: 'Swipe to see the transformation ✨ From idea to reality in just 5 steps! Which step surprised you most?',
        engagement: 'High',
        bestTime: '2:00 PM'
      },
      {
        type: 'Lifestyle',
        content: 'Morning rituals that changed everything 🌅 Save this post for your tomorrow self! What\'s your favorite morning habit?',
        engagement: 'High',
        bestTime: '8:00 AM'
      },
      {
        type: 'Trending',
        content: 'POV: You finally figured out the secret to [relevant topic] 💡 Drop a 🔥 if you relate!',
        engagement: 'Medium',
        bestTime: '6:00 PM'
      }
    ]
  };

  const imageFeedback = {
    lighting: { score: 8.5, feedback: 'Great natural lighting with well-balanced exposure. The golden hour timing creates warm, inviting tones.' },
    composition: { score: 7.2, feedback: 'Good use of rule of thirds, but consider tighter framing to create more visual impact for social media.' },
    sharpness: { score: 9.1, feedback: 'Excellent focus and clarity throughout the image. Fine details are crisp and well-defined.' },
    colors: { score: 8.8, feedback: 'Vibrant color palette with good saturation. Colors are true to life with nice contrast.' },
    overall: 'This image has strong potential for social media engagement. The natural lighting and sharp details work well for both Facebook and Instagram. Consider enhancing the colors slightly and cropping for better mobile viewing to maximize impact.'
  };

  const suggestedEnhancements = [
    {
      title: 'Brightness & Contrast',
      description: 'Optimize lighting for better visibility on mobile screens',
      improvement: '+15% engagement potential'
    },
    {
      title: 'Color Saturation',
      description: 'Enhance colors to make them pop on social feeds',
      improvement: '+12% visual appeal'
    },
    {
      title: 'Smart Crop',
      description: 'Crop to optimal aspect ratio for your selected platform',
      improvement: `Perfect for ${selectedPlatform} format`
    },
    {
      title: 'Sharpening',
      description: 'Apply subtle sharpening for crisp mobile display',
      improvement: '+8% clarity improvement'
    }
  ];

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        setIsAnalyzing(true);
        // Simulate AI enhancement
        setTimeout(() => {
          setIsAnalyzing(false);
          setEnhancedImage(e.target?.result as string); // In real app, this would be the enhanced version
        }, 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateAISuggestion = () => {
    if (!selectedPlatform) return;
    
    const suggestions = selectedPlatform === 'facebook' 
      ? [
          'Share a behind-the-scenes moment that your community would love to see',
          'Ask an engaging question that sparks meaningful conversations',
          'Share a valuable tip or insight from your recent experience',
          'Tell a story about a challenge you overcame and what you learned'
        ]
      : [
          'Create a visually stunning carousel showcasing your process',
          'Share an authentic moment with a relatable caption',
          'Post a trending-style video with engaging text overlay',
          'Share a transformation or before/after that tells your story'
        ];
    
    setCurrentPost(suggestions[Math.floor(Math.random() * suggestions.length)]);
  };

  const currentSuggestions = selectedPlatform ? platformSuggestions[selectedPlatform] : [];

  return (
    <div className="space-y-6">
      {/* Platform Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Platform</CardTitle>
          <CardDescription>Choose the platform you're creating content for to get tailored suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <Button
              variant={selectedPlatform === 'facebook' ? 'default' : 'outline'}
              onClick={() => setSelectedPlatform('facebook')}
              className="flex items-center gap-2 h-12"
            >
              <Facebook className="w-5 h-5" />
              Facebook
            </Button>
            <Button
              variant={selectedPlatform === 'instagram' ? 'default' : 'outline'}
              onClick={() => setSelectedPlatform('instagram')}
              className="flex items-center gap-2 h-12"
            >
              <Instagram className="w-5 h-5" />
              Instagram
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedPlatform && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Content Suggestions for {selectedPlatform === 'facebook' ? 'Facebook' : 'Instagram'}
              </CardTitle>
              <CardDescription>
                Get personalized post ideas optimized for {selectedPlatform === 'facebook' ? 'Facebook\'s community-focused audience' : 'Instagram\'s visual storytelling format'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {currentSuggestions.map((suggestion, index) => (
                  <Card key={index} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.type}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Target className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{suggestion.engagement}</span>
                        </div>
                      </div>
                      <p className="text-sm">{suggestion.content}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Best time: {suggestion.bestTime}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-primary" />
                  Create Your Text for {selectedPlatform === 'facebook' ? 'Facebook' : 'Instagram'}
                </CardTitle>
                <CardDescription>
                  {selectedPlatform === 'facebook' 
                    ? 'Write engaging posts that spark conversations and build community'
                    : 'Craft captivating captions with hashtags and visual storytelling elements'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="post-content">Post Content</Label>
                  <Textarea
                    id="post-content"
                    placeholder={selectedPlatform === 'facebook' 
                      ? 'Share your thoughts, ask questions, tell your story...'
                      : 'Write your caption with emojis and hashtags...'
                    }
                    value={currentPost}
                    onChange={(e) => setCurrentPost(e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={generateAISuggestion} variant="outline" size="sm">
                    <Lightbulb className="w-4 h-4 mr-2" />
                    AI Suggest
                  </Button>
                  <Button size="sm">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Enhance with AI
                  </Button>
                </div>
                {selectedPlatform === 'instagram' && (
                  <div className="text-xs text-muted-foreground">
                    💡 Tip: Use 5-10 hashtags, include emojis, and ask questions to boost engagement
                  </div>
                )}
                {selectedPlatform === 'facebook' && (
                  <div className="text-xs text-muted-foreground">
                    💡 Tip: Posts with questions get 100% more comments. Share personal experiences for better reach.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary" />
                  Image Analysis & Enhancement
                </CardTitle>
                <CardDescription>
                  Upload your image for AI analysis and see suggested improvements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="upload" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="upload">Upload & Analyze</TabsTrigger>
                    <TabsTrigger value="comparison" disabled={!enhancedImage}>AI Enhancement</TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="space-y-4">
                    {!uploadedImage ? (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="mb-2">Upload an Image</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                          Get AI feedback on lighting, composition, and platform optimization
                        </p>
                        <div className="relative">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <Button>Choose Image</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative">
                          <ImageWithFallback
                            src={uploadedImage}
                            alt="Uploaded image"
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        </div>
                        
                        {isAnalyzing ? (
                          <div className="flex items-center justify-center p-6">
                            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                            <span className="text-sm">Analyzing image and generating enhancements...</span>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid gap-3">
                              <div className="flex items-center justify-between p-3 border rounded">
                                <span className="text-sm">Lighting</span>
                                <Badge variant="outline">{imageFeedback.lighting.score}/10</Badge>
                              </div>
                              <div className="flex items-center justify-between p-3 border rounded">
                                <span className="text-sm">Composition</span>
                                <Badge variant="outline">{imageFeedback.composition.score}/10</Badge>
                              </div>
                              <div className="flex items-center justify-between p-3 border rounded">
                                <span className="text-sm">Sharpness</span>
                                <Badge variant="outline">{imageFeedback.sharpness.score}/10</Badge>
                              </div>
                              <div className="flex items-center justify-between p-3 border rounded">
                                <span className="text-sm">Colors</span>
                                <Badge variant="outline">{imageFeedback.colors.score}/10</Badge>
                              </div>
                            </div>
                            
                            <div className="p-4 bg-muted/50 rounded-lg">
                              <h4 className="mb-2">Image Analysis</h4>
                              <p className="text-sm mb-3">{imageFeedback.overall}</p>
                              <div className="space-y-2 text-sm">
                                <p><strong>Lighting:</strong> {imageFeedback.lighting.feedback}</p>
                                <p><strong>Composition:</strong> {imageFeedback.composition.feedback}</p>
                                <p><strong>Technical Quality:</strong> {imageFeedback.sharpness.feedback}</p>
                                <p><strong>Color Quality:</strong> {imageFeedback.colors.feedback}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="comparison" className="space-y-4">
                    {enhancedImage && (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="text-sm mb-2">Original</h4>
                            <ImageWithFallback
                              src={uploadedImage!}
                              alt="Original image"
                              className="w-full h-40 object-cover rounded-lg border"
                            />
                          </div>
                          <div>
                            <h4 className="text-sm mb-2 flex items-center gap-2">
                              AI Enhanced
                              <Badge variant="outline" className="text-xs">
                                <Sparkles className="w-3 h-3 mr-1" />
                                Optimized
                              </Badge>
                            </h4>
                            <ImageWithFallback
                              src={enhancedImage}
                              alt="Enhanced image"
                              className="w-full h-40 object-cover rounded-lg border border-primary/20"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Applied Enhancements
                          </h4>
                          {suggestedEnhancements.map((enhancement, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <h5 className="text-sm font-medium">{enhancement.title}</h5>
                                <p className="text-xs text-muted-foreground">{enhancement.description}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {enhancement.improvement}
                              </Badge>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button className="flex-1">
                            Use Enhanced Image
                          </Button>
                          <Button variant="outline">
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      
      {!selectedPlatform && (
        <div className="text-center py-12 text-muted-foreground">
          <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a platform above to get started with AI-powered content creation</p>
        </div>
      )}
    </div>
  );
}
