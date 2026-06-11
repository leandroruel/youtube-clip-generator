export async function processVideoWorkflow(youtubeUrl: string): Promise<string> {
  return JSON.stringify({ youtubeUrl, status: 'pending' });
}
