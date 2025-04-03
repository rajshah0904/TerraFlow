import requests
from fastapi import HTTPException
import os
import random
import time

# You can use a free API key from ExchangeRate-API or similar service
API_KEY = os.getenv("EXCHANGE_RATE_API_KEY", "")

# Mock exchange rates for demo purposes
MOCK_RATES = {
    "USD": {"USDT": 1.0, "EUR": 0.85, "GBP": 0.75, "JPY": 110.0, "CAD": 1.25, "AUD": 1.30, "SGD": 1.35},
    "USDT": {"USD": 1.0, "EUR": 0.85, "GBP": 0.75, "JPY": 110.0, "CAD": 1.25, "AUD": 1.30, "SGD": 1.35},
    "EUR": {"USD": 1.17, "USDT": 1.17, "GBP": 0.88, "JPY": 129.5, "CAD": 1.47, "AUD": 1.53, "SGD": 1.58},
    "GBP": {"USD": 1.33, "USDT": 1.33, "EUR": 1.14, "JPY": 146.7, "CAD": 1.66, "AUD": 1.73, "SGD": 1.80},
    "JPY": {"USD": 0.009, "USDT": 0.009, "EUR": 0.0077, "GBP": 0.0068, "CAD": 0.011, "AUD": 0.012, "SGD": 0.012},
    "CAD": {"USD": 0.80, "USDT": 0.80, "EUR": 0.68, "GBP": 0.60, "JPY": 88.0, "AUD": 1.04, "SGD": 1.08},
    "AUD": {"USD": 0.77, "USDT": 0.77, "EUR": 0.65, "GBP": 0.58, "JPY": 84.6, "CAD": 0.96, "SGD": 1.04},
    "SGD": {"USD": 0.74, "USDT": 0.74, "EUR": 0.63, "GBP": 0.56, "JPY": 81.5, "CAD": 0.93, "AUD": 0.96}
}

def get_mock_rate(source: str, target: str) -> float:
    """Get mock exchange rate with slight randomness for demo purposes"""
    # Add slight randomness to make it realistic
    base_rate = MOCK_RATES.get(source, {}).get(target)
    if base_rate:
        # Add ±2% random fluctuation
        fluctuation = random.uniform(-0.02, 0.02)
        return base_rate * (1 + fluctuation)
    
    # If direct rate not found, try reverse rate
    reverse_rate = MOCK_RATES.get(target, {}).get(source)
    if reverse_rate:
        fluctuation = random.uniform(-0.02, 0.02)
        return 1 / (reverse_rate * (1 + fluctuation))
    
    # Default fallback
    return 1.0

def fetch_conversion_rate(source_currency: str, target_currency: str = "USDT") -> float:
    """
    Fetch conversion rate between two currencies.
    For crypto pairs, tries Binance API first.
    For fiat-to-fiat, uses Exchange Rate API.
    For fiat-to-crypto or crypto-to-fiat, converts through USD.
    
    Falls back to mock data for demo if API calls fail.
    """
    # Normalize currencies
    source = source_currency.upper()
    target = target_currency.upper()
    
    # For demo purposes, add small delay to simulate API call
    time.sleep(0.1)
    
    # Try to get real rates first
    try:
        # Check if we're dealing with crypto pairs (with USDT)
        if (source == "USDT" or target == "USDT"):
            try:
                if source == "USDT":
                    pair = f"{target}USDT"  # Like EURUSDT
                    rate = fetch_binance_rate(pair)
                    return 1.0 / rate  # Invert for USDT to currency
                else:
                    pair = f"{source}USDT"  # Like USDTEUR
                    return fetch_binance_rate(pair)
            except HTTPException:
                # If Binance fails, try fiat conversion or fall back to mock
                pass
        
        # Try direct fiat-to-fiat conversion
        try:
            return fetch_fiat_rate(source, target)
        except Exception:
            # If direct conversion fails, try converting through USD
            try:
                if source != "USD" and target != "USD":
                    source_to_usd = fetch_fiat_rate(source, "USD")
                    usd_to_target = fetch_fiat_rate("USD", target)
                    return source_to_usd * usd_to_target
            except Exception:
                # Finally fall back to mock data
                pass
    except Exception as e:
        print(f"Error fetching real rates: {str(e)}. Falling back to mock data.")
    
    # Fall back to mock data if all real-time sources fail
    return get_mock_rate(source, target)

def fetch_binance_rate(pair: str) -> float:
    """Fetch crypto rates from Binance"""
    try:
        url = f"https://api.binance.com/api/v3/ticker/price?symbol={pair}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return float(response.json()["price"])
    except Exception as e:
        print(f"Binance API error: {str(e)}")
    
    # If api call fails, fallback to mock data
    if pair.endswith("USDT"):
        currency = pair[:-4]  # Remove USDT suffix
        return 1.0 / get_mock_rate("USDT", currency)
    else:
        return get_mock_rate(pair[:4], "USDT")  # Assume first 4 chars are currency code

def fetch_fiat_rate(source: str, target: str) -> float:
    """Fetch fiat currency rates from ExchangeRate-API or similar"""
    try:
        # Using ExchangeRate-API as an example
        if API_KEY:
            url = f"https://v6.exchangerate-api.com/v6/{API_KEY}/pair/{source}/{target}"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("result") == "success":
                    return data.get("conversion_rate", 1.0)
        
        # Fallback to a free open API if no API key is provided
        url = f"https://open.er-api.com/v6/latest/{source}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("rates") and target in data.get("rates", {}):
                return data.get("rates", {}).get(target, 1.0)
    except Exception as e:
        print(f"Exchange rate API error: {str(e)}")
    
    # If all APIs fail, use mock data
    return get_mock_rate(source, target)
