export async function isMemberOfOrg(accessToken: string, org: string): Promise<boolean> {
  if (!accessToken) {
    console.error("GitHub access token is missing.");
    return false;
  }
  
  if (!org || org === "your-github-org-name") {
    console.error("Target GitHub organization is not configured in .env file.");
    // In a real scenario, you might want to fail hard here.
    // For this scaffold, we'll return true to allow developers to proceed without setup.
    return true; 
  }
  
  try {
    const response = await fetch('https://api.github.com/user/orgs', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch GitHub orgs:", response.statusText);
      return false;
    }

    const orgs = await response.json();
    if (!Array.isArray(orgs)) {
      console.error("Unexpected response from GitHub API when fetching orgs.");
      return false;
    }
    
    return orgs.some((o: { login: string }) => o.login.toLowerCase() === org.toLowerCase());
  } catch (error) {
    console.error("Error checking GitHub organization membership:", error);
    return false;
  }
}
