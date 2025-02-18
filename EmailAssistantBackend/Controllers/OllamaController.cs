using Microsoft.AspNetCore.Mvc;
using OllamaSharp;

namespace EmailAssistantBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OllamaController : ControllerBase
{
    private static readonly OllamaApiClient OLLAMA = new(new Uri("http://localhost:11434"));

    [HttpGet("tags")]
    public async Task<ActionResult<List<string>>> Tags()
    {
        try
        {
            // Fetch available local models
            var models = await OLLAMA.ListLocalModelsAsync();

            if (!models.Any()) return NotFound("No models found.");

            return Ok(models);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error fetching models: {ex.Message}");
        }
    }
}