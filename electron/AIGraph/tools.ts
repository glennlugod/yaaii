import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const getWeather = tool((input) => {
  if (['sf', 'san francisco'].includes(input.location.toLowerCase())) {
    return 'It\'s 60 degrees and foggy.';
  } else {
    return 'It\'s 90 degrees and sunny.';
  }
}, {
  name: 'get_weather',
  description: 'Call to get the current weather.',
  schema: z.object({
    location: z.string().describe("Location to get the weather for."),
  })
});

const getCoolestCities = tool(() => {
  return 'nyc, sf';
}, {
  name: 'get_coolest_cities',
  description: 'Get a list of coolest cities',
  schema: z.object({
    noOp: z.string().optional().describe("No-op parameter."),
  })
});

export const tools = [getWeather, getCoolestCities];
