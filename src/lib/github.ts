export async function isMemberOfOrg(accessToken: string, orgs: string[]): Promise<boolean> {
  if (!accessToken) {
    console.error("GitHub access token is missing.");
    return false;
  }

  const validOrgs = orgs.filter(Boolean);
  if (validOrgs.length === 0) {
    console.error("Target GitHub organization(s) are not configured in .env file.");
    // For development, allow proceeding without org setup if no orgs are provided.
    // In a production environment, you might want this to fail.
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

    const userOrgs = await response.json();
    if (!Array.isArray(userOrgs)) {
      console.error("Unexpected response from GitHub API when fetching orgs.");
      return false;
    }
    
    // Check if the user is a member of ANY of the provided orgs
    const userOrgLogins = userOrgs.map((o: { login: string }) => o.login.toLowerCase());
    
    // --- DEBUG LOG ---
    console.log("Required Orgs:", validOrgs.map(o => o.toLowerCase()));
    console.log("User's Orgs:", userOrgLogins);
    // --- END DEBUG LOG ---

    return validOrgs.some(requiredOrg => userOrgLogins.includes(requiredOrg.toLowerCase()));

  } catch (error) {
    console.error("Error checking GitHub organization membership:", error);
    return false;
  }
}
